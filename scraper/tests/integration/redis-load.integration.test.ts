import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import Redis from 'ioredis';
import { SCRAPE_DLQ_KEY, SCRAPE_JOBS_KEY, type ScrapeJob } from '@allo-scrapper/logger';
import { RedisJobConsumer } from '../../src/redis/client.js';

let redisContainer: StartedTestContainer;
let redisUrl = '';
let redis: Redis;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readContainerLogs(): Promise<string> {
  if (!redisContainer) return '';

  const stream = await redisContainer.logs();
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      stream.destroy();
      resolve(Buffer.concat(chunks).toString('utf8'));
    }, 1000);

    stream.on('data', (chunk: string | Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    stream.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs: number, intervalMs: number = 50): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }

    await sleep(intervalMs);
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

beforeAll(async () => {
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const host = redisContainer.getHost() === 'localhost' ? '127.0.0.1' : redisContainer.getHost();
  const port = redisContainer.getMappedPort(6379);
  redisUrl = `redis://${host}:${port}`;
  redis = new Redis(redisUrl, { lazyConnect: false });
}, 60000);

beforeEach(async () => {
  await redis.flushdb();
});

afterEach(async (ctx) => {
  await redis.flushdb();

  if (ctx.task.result?.state === 'fail') {
    const logs = await readContainerLogs();
    process.stderr.write(`\n[scraper-redis-load] REDIS_URL=${redisUrl}\n`);
    process.stderr.write(`[scraper-redis-load] logs:\n${logs}\n`);
  }
});

afterAll(async () => {
  await redis.quit();

  if (redisContainer) {
    await redisContainer.stop();
  }
}, 30000);

describe('RedisJobConsumer load integration', () => {
  it('processes 100 queued jobs without loss and keeps later jobs moving while retries are delayed', async () => {
    const totalJobs = 100;
    const retryOnceReportId = 5;
    const terminalFailureReportId = 10;
    const jobs: ScrapeJob[] = Array.from({ length: totalJobs }, (_, index) => ({
      type: 'scrape',
      triggerType: 'manual',
      reportId: index + 1,
    }));

    await redis.rpush(SCRAPE_JOBS_KEY, ...jobs.map((job) => JSON.stringify(job)));

    const consumer = new RedisJobConsumer(redisUrl);
    const attemptCounts = new Map<number, number>();
    const successfulCompletions: Array<{ reportId: number; completedAt: number }> = [];
    const queueDepthSamples: number[] = [await redis.llen(SCRAPE_JOBS_KEY)];
    let firstFailureAt: number | null = null;
    let consumerStopped = false;

    const depthSampler = setInterval(() => {
      void redis.llen(SCRAPE_JOBS_KEY).then((depth) => {
        queueDepthSamples.push(depth);
      });
    }, 50);

    const startPromise = consumer.start(async (job) => {
      const nextAttempt = (attemptCounts.get(job.reportId) ?? 0) + 1;
      attemptCounts.set(job.reportId, nextAttempt);

      if (job.reportId === retryOnceReportId && nextAttempt === 1) {
        firstFailureAt ??= Date.now();
        throw new Error('retry once under load');
      }

      if (job.reportId === terminalFailureReportId) {
        firstFailureAt ??= Date.now();
        throw new Error('terminal failure under load');
      }

      await sleep(20);
      successfulCompletions.push({ reportId: job.reportId, completedAt: Date.now() });
    });

    try {
      await waitFor(async () => {
        const queueDepth = await redis.llen(SCRAPE_JOBS_KEY);
        const dlqDepth = await redis.zcard(SCRAPE_DLQ_KEY);

        return successfulCompletions.length === totalJobs - 1
          && queueDepth === 0
          && dlqDepth === 1
          && attemptCounts.get(retryOnceReportId) === 2
          && attemptCounts.get(terminalFailureReportId) === 3;
      }, 15000);
    } finally {
      clearInterval(depthSampler);

      if (!consumerStopped) {
        consumer.stop();
        consumerStopped = true;
      }

      await consumer.disconnect();
      await startPromise;
    }

    queueDepthSamples.push(await redis.llen(SCRAPE_JOBS_KEY));

    const dlqEntries = await redis.zrange(SCRAPE_DLQ_KEY, 0, -1);
    const firstSuccessAfterFailure = successfulCompletions.find((entry) => entry.completedAt > (firstFailureAt ?? 0));
    const completedIds = new Set(successfulCompletions.map((entry) => entry.reportId));
    const distinctDepths = new Set(queueDepthSamples);

    expect(firstFailureAt).not.toBeNull();
    expect(firstSuccessAfterFailure).toBeDefined();
    expect(firstSuccessAfterFailure!.completedAt - firstFailureAt!).toBeLessThan(400);
    expect(completedIds.size).toBe(totalJobs - 1);
    expect(completedIds.has(terminalFailureReportId)).toBe(false);
    expect(completedIds.has(retryOnceReportId)).toBe(true);
    expect(attemptCounts.get(retryOnceReportId)).toBe(2);
    expect(attemptCounts.get(terminalFailureReportId)).toBe(3);
    expect(queueDepthSamples[0]).toBe(totalJobs);
    expect(queueDepthSamples.at(-1)).toBe(0);
    expect(distinctDepths.size).toBeGreaterThan(5);
    expect(Math.min(...queueDepthSamples)).toBe(0);
    expect(dlqEntries).toHaveLength(1);
    expect(dlqEntries[0]).toContain(`"reportId":${terminalFailureReportId}`);
    expect(dlqEntries[0]).toContain('"retry_count":3');
  }, 20000);
});
