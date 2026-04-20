import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

export interface TrackedOrg {
  orgId: number;
  orgSlug: string;
  testId: string;
  workerId: string;
  createdAt: number;
}

interface RegistryFile {
  records: TrackedOrg[];
}

export interface CleanupSummary {
  deleted: number;
  failed: number;
  skipped: number;
  deduped: number;
  durationMs: number;
}

export interface DeleteResult {
  ok: boolean;
  status: number;
}

export type DeleteOrgFn = (orgId: number) => Promise<DeleteResult>;

interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export interface CleanupOptions {
  deleteOrg: DeleteOrgFn;
  logger?: Logger;
  now?: number;
  allowedSlugPrefix?: string;
  maxAgeMs?: number;
}

const DEFAULT_ALLOWED_SLUG_PREFIX = 'e2e-test-';
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function getRegistryDirectory(): string {
  return process.env['ALLO_E2E_ORG_REGISTRY_DIR']
    ?? path.join(tmpdir(), 'allo-scrapper-e2e-org-registry');
}

const defaultLogger: Logger = {
  info: (message, meta) => console.info(message, meta ?? {}),
  warn: (message, meta) => console.warn(message, meta ?? {}),
  error: (message, meta) => console.error(message, meta ?? {}),
};

function getRegistryFilePath(workerId: string): string {
  return path.join(getRegistryDirectory(), `worker-${workerId}-pid-${process.pid}.json`);
}

async function ensureRegistryDirectory(): Promise<void> {
  await mkdir(getRegistryDirectory(), { recursive: true });
}

async function readRegistry(filePath: string): Promise<RegistryFile> {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<RegistryFile>;
    return { records: Array.isArray(parsed.records) ? parsed.records as TrackedOrg[] : [] };
  } catch {
    return { records: [] };
  }
}

async function writeRegistry(filePath: string, data: RegistryFile): Promise<void> {
  await ensureRegistryDirectory();
  await writeFile(filePath, JSON.stringify(data), 'utf8');
}

function summarize(startedAt: number, deleted: number, failed: number, skipped: number, deduped: number): CleanupSummary {
  return {
    deleted,
    failed,
    skipped,
    deduped,
    durationMs: Date.now() - startedAt,
  };
}

function isEligible(record: TrackedOrg, allowedSlugPrefix: string, now: number, maxAgeMs: number): boolean {
  if (!record.orgSlug.startsWith(allowedSlugPrefix)) return false;
  return now - record.createdAt <= maxAgeMs;
}

export async function registerTestOrg(record: TrackedOrg): Promise<void> {
  const registryFilePath = getRegistryFilePath(record.workerId);
  const registry = await readRegistry(registryFilePath);

  const alreadyTracked = registry.records.some((existing) => existing.orgId === record.orgId && existing.testId === record.testId);
  if (alreadyTracked) {
    return;
  }

  registry.records.push(record);
  await writeRegistry(registryFilePath, registry);
}

export async function cleanupTestOrgs(testId: string, workerId: string, options: CleanupOptions): Promise<CleanupSummary> {
  const startedAt = Date.now();
  const logger = options.logger ?? defaultLogger;
  const registryFilePath = getRegistryFilePath(workerId);
  const registry = await readRegistry(registryFilePath);

  const matching = registry.records.filter((record) => record.testId === testId);
  const uniqueOrgIds = [...new Set(matching.map((record) => record.orgId))];

  let deleted = 0;
  let failed = 0;
  let skipped = 0;
  const deduped = matching.length - uniqueOrgIds.length;

  await Promise.all(uniqueOrgIds.map(async (orgId) => {
    const orgStart = Date.now();
    try {
      const result = await options.deleteOrg(orgId);
      const elapsed = Date.now() - orgStart;
      if (result.ok) {
        deleted += 1;
        logger.info('e2e cleanup delete success', { org_id: orgId, test_id: testId, worker_id: workerId, duration_ms: elapsed });
      } else if (result.status === 404) {
        skipped += 1;
        logger.info('e2e cleanup delete skipped', { org_id: orgId, test_id: testId, worker_id: workerId, status: result.status, duration_ms: elapsed });
      } else {
        failed += 1;
        logger.error('e2e cleanup delete failed', { org_id: orgId, test_id: testId, worker_id: workerId, status: result.status, duration_ms: elapsed });
      }
    } catch (error) {
      failed += 1;
      logger.error('e2e cleanup delete exception', { org_id: orgId, test_id: testId, worker_id: workerId, error: error instanceof Error ? error.message : String(error) });
    }
  }));

  const remaining = registry.records.filter((record) => record.testId !== testId);
  await writeRegistry(registryFilePath, { records: remaining });

  return summarize(startedAt, deleted, failed, skipped, deduped);
}

export async function cleanupAllTrackedOrgs(options: CleanupOptions): Promise<CleanupSummary> {
  const startedAt = Date.now();
  const logger = options.logger ?? defaultLogger;
  const now = options.now ?? Date.now();
  const allowedSlugPrefix = options.allowedSlugPrefix ?? DEFAULT_ALLOWED_SLUG_PREFIX;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

  await ensureRegistryDirectory();
  const registryDirectory = getRegistryDirectory();
  const entries = await readdir(registryDirectory, { withFileTypes: true });

  let deleted = 0;
  let failed = 0;
  let skipped = 0;
  let deduped = 0;
  const globallySeenOrgIds = new Set<number>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(registryDirectory, entry.name);
    const registry = await readRegistry(filePath);

    const eligibleRecords = registry.records.filter((record) => isEligible(record, allowedSlugPrefix, now, maxAgeMs));
    const uniqueOrgIds = [...new Set(eligibleRecords.map((record) => record.orgId))];
    deduped += eligibleRecords.length - uniqueOrgIds.length;

    await Promise.all(uniqueOrgIds.map(async (orgId) => {
      if (globallySeenOrgIds.has(orgId)) {
        deduped += 1;
        return;
      }
      globallySeenOrgIds.add(orgId);

      const orgStart = Date.now();
      try {
        const result = await options.deleteOrg(orgId);
        const elapsed = Date.now() - orgStart;
        if (result.ok) {
          deleted += 1;
          logger.info('e2e global cleanup delete success', { org_id: orgId, duration_ms: elapsed });
        } else if (result.status === 404) {
          skipped += 1;
          logger.info('e2e global cleanup delete skipped', { org_id: orgId, status: result.status, duration_ms: elapsed });
        } else {
          failed += 1;
          logger.error('e2e global cleanup delete failed', { org_id: orgId, status: result.status, duration_ms: elapsed });
        }
      } catch (error) {
        failed += 1;
        logger.error('e2e global cleanup delete exception', { org_id: orgId, error: error instanceof Error ? error.message : String(error) });
      }
    }));

    await rm(filePath, { force: true });
  }

  return summarize(startedAt, deleted, failed, skipped, deduped);
}
