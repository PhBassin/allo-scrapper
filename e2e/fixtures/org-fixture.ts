import { test as base, expect, type APIRequestContext, type TestInfo } from '@playwright/test';
import { randomBytes } from 'crypto';
import { cleanupAllTrackedOrgs, cleanupTestOrgs, registerTestOrg, type DeleteResult } from './org-cleanup';

const DEFAULT_MAX_TEST_DURATION_MS = 120_000;
const DEFAULT_MAX_CLEANUP_DURATION_MS = 500;

interface SeededOrg {
  orgId: number;
  orgSlug: string;
  schemaName: string;
  planId: number;
  admin: {
    id: number;
    username: string;
    password: string;
  };
}

interface SeedTestOrgOptions {
  planId?: number;
}

type OrgFixtures = {
  seedTestOrg: (options?: SeedTestOrgOptions) => Promise<SeededOrg>;
  autoOrgCleanup: void;
};

export function assertFixtureRuntimeWithinLimit(startedAt: number, maxDurationMs = DEFAULT_MAX_TEST_DURATION_MS): void {
  const durationMs = Date.now() - startedAt;

  expect(durationMs, `Expected E2E test to finish within ${maxDurationMs}ms, received ${durationMs}ms`).toBeLessThan(maxDurationMs);
}

export function assertFixtureCleanupSummary(
  summary: { failed: number; durationMs: number },
  maxDurationMs = DEFAULT_MAX_CLEANUP_DURATION_MS,
): void {
  expect(summary.failed, 'Expected fixture cleanup to complete without failures').toBe(0);
  expect(
    summary.durationMs,
    `Expected fixture cleanup to finish within ${maxDurationMs}ms, received ${summary.durationMs}ms`,
  ).toBeLessThan(maxDurationMs);
}

function buildTestSlug(testInfo: TestInfo): string {
  const worker = `w${testInfo.workerIndex}`;
  const stamp = Date.now().toString(36);
  const rand = randomBytes(4).toString('hex');
  return `e2e-test-${worker}-${stamp}-${rand}`;
}

async function deleteOrg(request: APIRequestContext, orgId: number): Promise<DeleteResult> {
  const response = await request.delete(`/test/cleanup-org/${orgId}`);
  return { ok: response.ok(), status: response.status() };
}

export const test = base.extend<OrgFixtures>({
  seedTestOrg: async ({ request }, use, testInfo) => {
    const seed = async (options?: SeedTestOrgOptions): Promise<SeededOrg> => {
      const slug = buildTestSlug(testInfo);
      const response = await request.post('/test/seed-org', {
        data: {
          slug,
          name: `E2E ${slug}`,
          adminEmail: `${slug}@test.local`,
          adminPassword: `P@ss-${slug}-Aa1!`,
          planId: options?.planId,
        },
      });

      if (!response.ok()) {
        throw new Error(`Failed to seed test org: status=${response.status()}`);
      }

      const payload = await response.json() as {
        data: {
          org_id: number;
          org_slug: string;
          schema_name: string;
          plan_id: number;
          admin: { id: number; username: string; password: string };
        };
      };

      await registerTestOrg({
        orgId: payload.data.org_id,
        orgSlug: payload.data.org_slug,
        testId: testInfo.testId,
        workerId: String(testInfo.workerIndex),
        createdAt: Date.now(),
      });

      return {
        orgId: payload.data.org_id,
        orgSlug: payload.data.org_slug,
        schemaName: payload.data.schema_name,
        planId: payload.data.plan_id,
        admin: payload.data.admin,
      };
    };

    await use(seed);
  },

  autoOrgCleanup: [async ({ request }: { request: APIRequestContext }, use: () => Promise<void>, testInfo: TestInfo) => {
    await use();
    const summary = await cleanupTestOrgs(testInfo.testId, String(testInfo.workerIndex), {
      deleteOrg: (orgId) => deleteOrg(request, orgId),
    });

    assertFixtureCleanupSummary(summary);

    if (summary.failed > 0) {
      console.error('e2e afterEach cleanup failures', {
        test_id: testInfo.testId,
        worker_id: testInfo.workerIndex,
        ...summary,
      });
    }
  }, { auto: true }],
});

export async function runGlobalOrgCleanup(baseUrl: string): Promise<void> {
  const startedAt = Date.now();
  const summary = await cleanupAllTrackedOrgs({
    deleteOrg: async (orgId) => {
      const response = await fetch(`${baseUrl}/test/cleanup-org/${orgId}`, { method: 'DELETE' });
      return { ok: response.ok, status: response.status };
    },
  });

  const meta = {
    ...summary,
    base_url: baseUrl,
    run_duration_ms: Date.now() - startedAt,
  };

  if (summary.failed > 0) {
    console.error('e2e global cleanup failures', meta);
  } else {
    console.info('e2e global cleanup summary', meta);
  }
}

export { expect };
