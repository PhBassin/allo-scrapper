import { test, expect } from './fixtures/org-fixture';

const useOrgFixture = process.env['E2E_ENABLE_ORG_FIXTURE'] === 'true';
const enableLongRunningSse = process.env['E2E_LONG_RUNNING_SSE'] === 'true';
const configuredConcurrency = Number(process.env['SCRAPER_CONCURRENCY'] ?? '0');
const configuredTheaterDelayMs = Number(process.env['SCRAPE_THEATER_DELAY_MS'] ?? '0');

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: number;
      username: string;
      role_id: number;
      role_name: string;
      is_system_role: boolean;
      permissions: string[];
      org_slug?: string;
    };
  };
}

interface CinemaResponse {
  success: boolean;
  data: Array<{ id: string; name: string; url?: string }>;
}

interface BrowserSseMonitorState {
  businessEventIds: string[];
  businessEventTypes: string[];
  connectionCount: number;
  duplicateEventIds: string[];
  errors: string[];
  isOpen: boolean;
  lastEventId?: string;
  monotonicViolations: string[];
  pingReceivedAt: number[];
  requestLastEventIds: Array<string | null>;
  stopped: boolean;
}

interface BrowserSseMonitor {
  state: BrowserSseMonitorState;
  forceReconnect: () => Promise<void>;
  stop: () => void;
}

declare global {
  interface Window {
    __sseLongRunMonitor?: BrowserSseMonitor;
  }
}

function getLongestGapMs(timestamps: number[]): number {
  if (timestamps.length < 2) {
    return 0;
  }

  let longestGapMs = 0;
  for (let i = 1; i < timestamps.length; i++) {
    longestGapMs = Math.max(longestGapMs, timestamps[i] - timestamps[i - 1]);
  }
  return longestGapMs;
}

test.describe('SSE long-running connection validation', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!useOrgFixture, 'Requires fixture-backed SaaS runtime (E2E_ENABLE_ORG_FIXTURE=true)');
  test.skip(!enableLongRunningSse, 'Long-running SSE validation is opt-in (E2E_LONG_RUNNING_SSE=true)');
  test.skip(
    configuredConcurrency !== 1 || configuredTheaterDelayMs < 30000,
    'Requires deterministic scraper runtime: SCRAPER_CONCURRENCY=1 and SCRAPE_THEATER_DELAY_MS>=30000',
  );

  test('keeps an authenticated tenant SSE stream alive for 10+ minutes and resumes after Last-Event-ID reconnect', async ({ page, request, seedTestOrg }) => {
    test.setTimeout(13 * 60 * 1000);

    const org = await seedTestOrg({ planId: 2 });
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        username: org.admin.username,
        password: org.admin.password,
      },
    });
    expect(loginResponse.ok()).toBe(true);

    const loginBody = await loginResponse.json() as LoginResponse;
    const token = loginBody.data.token;

    const cinemasResponse = await request.get(`/api/org/${org.orgSlug}/cinemas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cinemasResponse.ok()).toBe(true);

    const cinemasBody = await cinemasResponse.json() as CinemaResponse;
    const allocineCinemas = cinemasBody.data.filter((cinema) => cinema.url?.includes('allocine.fr'));
    expect(allocineCinemas.length).toBeGreaterThanOrEqual(21);

    await page.goto('/');
    await page.evaluate(([savedToken, user]) => {
      localStorage.setItem('token', savedToken);
      localStorage.setItem('user', JSON.stringify(user));
    }, [
      token,
      {
        ...loginBody.data.user,
        org_slug: org.orgSlug,
      },
    ]);

    await page.goto(`/org/${org.orgSlug}/admin?tab=cinemas`);
    await expect(page.getByTestId('scrape-all-button')).toBeVisible({ timeout: 10000 });

    await page.evaluate(([savedToken, orgSlug]) => {
      const state: BrowserSseMonitorState = {
        businessEventIds: [],
        businessEventTypes: [],
        connectionCount: 0,
        duplicateEventIds: [],
        errors: [],
        isOpen: false,
        monotonicViolations: [],
        pingReceivedAt: [],
        requestLastEventIds: [],
        stopped: false,
      };
      const seenEventIds = new Set<string>();
      const decoder = new TextDecoder();
      const originalFetch = window.fetch.bind(window);
      let activeConnectionId = 0;
      let activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let activeStreamController: ReadableStreamDefaultController<Uint8Array> | undefined;
      let buffer = '';

      const parseValue = (line: string, fieldName: string): string => {
        const rawValue = line.slice(fieldName.length + 1);
        return rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
      };

      const handleFrame = (frame: string): void => {
        let id: string | undefined;
        const dataLines: string[] = [];

        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('id:')) {
            id = parseValue(line, 'id');
            continue;
          }

          if (line.startsWith('data:')) {
            dataLines.push(parseValue(line, 'data'));
          }
        }

        if (dataLines.length === 0) {
          return;
        }

        try {
          const payload = JSON.parse(dataLines.join('\n')) as { type?: string };
          if (payload.type === 'ping') {
            state.pingReceivedAt.push(Date.now());
            return;
          }

          state.businessEventTypes.push(String(payload.type));

          if (!id) {
            state.errors.push(`missing business event id for ${String(payload.type)}`);
            return;
          }

          const previousId = state.lastEventId ? Number(state.lastEventId) : undefined;
          const currentId = Number(id);
          if (previousId !== undefined && currentId <= previousId) {
            state.monotonicViolations.push(`${id} <= ${state.lastEventId}`);
          }
          if (seenEventIds.has(id)) {
            state.duplicateEventIds.push(id);
          }

          seenEventIds.add(id);
          state.businessEventIds.push(id);
          state.lastEventId = id;
        } catch (error) {
          state.errors.push(error instanceof Error ? error.message : String(error));
        }
      };

      const isProgressRequest = (input: RequestInfo | URL): boolean => {
        const url = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

        return url.includes(`/api/org/${orgSlug}/scraper/progress`);
      };

      const getLastEventIdHeader = (headers?: HeadersInit): string | null => {
        if (!headers) {
          return null;
        }

        if (headers instanceof Headers) {
          return headers.get('Last-Event-ID');
        }

        if (Array.isArray(headers)) {
          const entry = headers.find(([key]) => key.toLowerCase() === 'last-event-id');
          return entry?.[1] ?? null;
        }

        const record = headers as Record<string, string>;
        return record['Last-Event-ID'] ?? record['last-event-id'] ?? null;
      };

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const response = await originalFetch(input, init);

        if (!isProgressRequest(input)) {
          return response;
        }

        const connectionId = ++activeConnectionId;
        state.connectionCount += 1;
        state.requestLastEventIds.push(getLastEventIdHeader(init?.headers));

        if (!response.ok || !response.body) {
          state.errors.push(
            !response.ok
              ? `SSE monitor failed with status ${response.status}`
              : 'SSE monitor response has no body'
          );
          return response;
        }

        state.isOpen = true;
        buffer = '';

        const reader = response.body.getReader();
        activeReader = reader;

        const monitoredBody = new ReadableStream<Uint8Array>({
          start(controller) {
            activeStreamController = controller;

            void (async () => {
              try {
                while (!state.stopped) {
                  const { done, value } = await reader.read();
                  if (done) {
                    buffer += decoder.decode();
                    if (buffer.trim()) {
                      handleFrame(buffer);
                      buffer = '';
                    }
                    controller.close();
                    break;
                  }

                  buffer += decoder.decode(value, { stream: true });
                  const frames = buffer.split(/\r?\n\r?\n/);
                  buffer = frames.pop() ?? '';
                  for (const frame of frames) {
                    handleFrame(frame);
                  }

                  controller.enqueue(value);
                }
              } catch (error) {
                if (!state.stopped) {
                  state.errors.push(error instanceof Error ? error.message : String(error));
                }
                controller.error(error);
              } finally {
                if (activeConnectionId === connectionId) {
                  state.isOpen = false;
                }
              }
            })();
          },
          cancel(reason) {
            return reader.cancel(reason);
          },
        });

        return new Response(monitoredBody, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      };

      window.__sseLongRunMonitor = {
        state,
        forceReconnect: async () => {
          if (!activeReader || !activeStreamController) {
            throw new Error('No active SSE reader to reconnect');
          }

          await activeReader.cancel('forced reconnect from test');
          activeStreamController.error(new Error('forced reconnect from test'));
        },
        stop: () => {
          state.stopped = true;
          void activeReader?.cancel('test cleanup');
          window.fetch = originalFetch;
        },
      };
    }, [token, org.orgSlug]);

    const triggerResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === 'POST'
        && response.url().includes(`/api/org/${org.orgSlug}/scraper/trigger`);
    });
    await page.getByTestId('scrape-all-button').click();
    const triggerResponse = await triggerResponsePromise;
    expect(triggerResponse.ok()).toBe(true);

    const progress = page.getByTestId('scrape-progress');
    await expect(progress).toBeVisible({ timeout: 10000 });
    await expect(progress.getByTestId('sse-connection-status')).toHaveText(/Connecté/i, { timeout: 60000 });
    await expect(progress.getByTestId('scrape-progress-percentage').first()).toBeVisible({ timeout: 60000 });
    await expect(progress.getByTestId('scrape-progress-eta')).toBeVisible({ timeout: 60000 });

    await expect.poll(async () => page.evaluate(() => window.__sseLongRunMonitor?.state.lastEventId ?? null), {
      timeout: 60000,
    }).not.toBeNull();

    const lastEventIdBeforeReconnect = await page.evaluate(() => window.__sseLongRunMonitor?.state.lastEventId);
    expect(lastEventIdBeforeReconnect).toBeTruthy();

    await page.evaluate(() => window.__sseLongRunMonitor?.forceReconnect());

    await expect.poll(async () => page.evaluate(() => window.__sseLongRunMonitor?.state.connectionCount ?? 0), {
      timeout: 10000,
    }).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => page.evaluate(() => window.__sseLongRunMonitor?.state.requestLastEventIds.at(-1) ?? null), {
      timeout: 10000,
    }).toBe(lastEventIdBeforeReconnect);
    await expect.poll(async () => page.evaluate(() => window.__sseLongRunMonitor?.state.isOpen ?? false), {
      timeout: 10000,
    }).toBe(true);
    await expect(progress.getByTestId('sse-connection-status')).toHaveText(/Connecté/i, { timeout: 60000 });

    await page.waitForTimeout(10 * 60 * 1000);

    const snapshot = await page.evaluate(() => window.__sseLongRunMonitor?.state);
    expect(snapshot).toBeTruthy();
    expect(snapshot?.errors).toEqual([]);
    expect(snapshot?.isOpen).toBe(true);
    expect(snapshot?.duplicateEventIds).toEqual([]);
    expect(snapshot?.monotonicViolations).toEqual([]);
    expect(snapshot?.businessEventTypes).toContain('started');
    expect(snapshot?.businessEventTypes).toContain('cinema_started');
    expect(snapshot?.businessEventTypes).not.toContain('completed');
    expect(snapshot?.businessEventTypes).not.toContain('failed');
    expect(snapshot?.pingReceivedAt.length).toBeGreaterThanOrEqual(19);
    expect(getLongestGapMs(snapshot?.pingReceivedAt ?? [])).toBeLessThanOrEqual(45000);

    await expect(progress.getByTestId('sse-connection-status')).toHaveText(/Connecté/i, { timeout: 60000 });
    await expect(progress.getByTestId('scrape-progress-percentage').first()).toBeVisible();

    await page.evaluate(() => window.__sseLongRunMonitor?.stop());
  });
});
