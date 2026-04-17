import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Buffer } from 'node:buffer';
import { RedisClient, getRedisClient, resetRedisClient } from './redis-client.js';
import type { ProgressEvent } from './progress-tracker.js';

let redisContainer: StartedTestContainer;
let redisUrl = '';

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

beforeAll(async () => {
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const host = redisContainer.getHost() === 'localhost' ? '127.0.0.1' : redisContainer.getHost();
  const port = redisContainer.getMappedPort(6379);
  redisUrl = `redis://${host}:${port}`;
  process.env.REDIS_URL = redisUrl;
  resetRedisClient();
}, 60000);

afterEach(async (ctx) => {
  resetRedisClient();

  if (ctx.task.result?.state === 'fail') {
    const logs = await readContainerLogs();
    process.stderr.write(`\n[redis-testcontainer] REDIS_URL=${redisUrl}\n`);
    process.stderr.write(`[redis-testcontainer] logs:\n${logs}\n`);
  }
});

afterAll(async () => {
  resetRedisClient();
  delete process.env.REDIS_URL;

  if (redisContainer) {
    await redisContainer.stop();
  }
}, 30000);

describe('RedisClient integration (Testcontainers)', () => {
  it('publishes scrape jobs and reports queue depth', async () => {
    const redis = getRedisClient();

    const queueLength = await redis.publishJob({
      type: 'scrape',
      triggerType: 'manual',
      reportId: 777,
    });

    expect(queueLength).toBeGreaterThanOrEqual(1);

    const depth = await redis.getQueueDepth();
    expect(depth).toBeGreaterThanOrEqual(1);

    await redis.disconnect();
  });

  it('publishes and subscribes progress events through redis pub/sub', async () => {
    const subscriber = new RedisClient(redisUrl);
    const publisher = new RedisClient(redisUrl);

    const received = new Promise<ProgressEvent>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for redis pub/sub event')), 8000);

      const onEvent = (event: ProgressEvent) => {
        clearTimeout(timeout);
        resolve(event);
      };

      void subscriber.subscribeToProgress(onEvent).catch(reject);
    });

    const event: ProgressEvent = {
      type: 'started',
      total_cinemas: 3,
      total_dates: 7,
    };

    await new Promise((resolve) => setTimeout(resolve, 100));
    await publisher.publishProgress(event);

    await expect(received).resolves.toEqual(event);

    await Promise.all([publisher.disconnect(), subscriber.disconnect()]);
  }, 10000);
});
