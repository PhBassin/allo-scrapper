import { test as base, expect, type APIRequestContext, type TestInfo } from '@playwright/test';
import { cleanupAllTrackedOrgs, cleanupTestOrgs, registerTestOrg, type DeleteResult } from './org-cleanup';

interface SeededOrg {
  orgId: number;
  orgSlug: string;
  schemaName: string;
  admin: {
    id: number;
    username: string;
    password: string;
  };
}

type OrgFixtures = {
  seedTestOrg: () => Promise<SeededOrg>;
  autoOrgCleanup: void;
};

function buildTestSlug(testInfo: TestInfo): string {
  const worker = `w${testInfo.workerIndex}`;
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e-test-${worker}-${stamp}-${rand}`;
}

async function deleteOrg(request: APIRequestContext, orgId: number): Promise<DeleteResult> {
  const response = await request.delete(`/test/cleanup-org/${orgId}`);
  return { ok: response.ok(), status: response.status() };
}

export const test = base.extend<OrgFixtures>({
  seedTestOrg: async ({ request }, use, testInfo) => {
    const seed = async (): Promise<SeededOrg> => {
      const slug = buildTestSlug(testInfo);
      const response = await request.post('/test/seed-org', {
        data: {
          slug,
          name: `E2E ${slug}`,
          adminEmail: `${slug}@test.local`,
          adminPassword: `P@ss-${slug}-Aa1!`,
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
