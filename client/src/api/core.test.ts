import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient, { ApiError } from './core';

const originalLocation = window.location;

function setApiBaseUrl(value: string) {
  import.meta.env.VITE_API_BASE_URL = value;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/`;
}

function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

type MockResponse = { status: number; body?: unknown; contentType?: string };

function mockFetchSequence(responses: Array<MockResponse>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const r = responses[i++] ?? responses[responses.length - 1];
    const headers = new Headers();
    const isJson = r.contentType ? r.contentType.includes('json') : r.body !== undefined;
    const contentType = r.contentType ?? (isJson ? 'application/json' : null);
    if (contentType) headers.set('content-type', contentType);
    if (r.body !== undefined) {
      const serialized = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      headers.set('content-length', String(serialized.length));
      return new Response(serialized, { status: r.status, headers });
    }
    headers.set('content-length', '0');
    return new Response(null, { status: r.status, headers });
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

describe('apiClient', () => {
  beforeEach(() => {
    setApiBaseUrl('/api');
    clearCookies();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('builds URL from endpoint and sets credentials include', async () => {
    const { calls } = mockFetchSequence([{ status: 200, body: JSON.stringify({ ok: true }) }]);
    const data = await apiClient.get('/foo');
    expect(data).toEqual({ ok: true });
    expect(calls[0].url).toBe('/api/foo');
    expect(calls[0].init.credentials).toBe('include');
  });

  it('serializes query params and supports array values', async () => {
    const { calls } = mockFetchSequence([{ status: 200, body: {} }]);
    await apiClient.get('/foo', { a: 1, b: ['x', 'y'], c: undefined, d: null });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/foo');
    expect(url.searchParams.get('a')).toBe('1');
    expect(url.searchParams.getAll('b[]')).toEqual(['x', 'y']);
    expect(url.searchParams.has('c')).toBe(false);
    expect(url.searchParams.has('d')).toBe(false);
  });

  it('sets JSON Content-Type and CSRF for non-GET methods', async () => {
    setCookie('csrf_token', 'csrf-abc');
    const { calls } = mockFetchSequence([{ status: 200, body: { id: 1 } }]);
    await apiClient.post('/foo', { hello: 'world' });
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-CSRF-Token')).toBe('csrf-abc');
    expect(calls[0].init.body).toBe('{"hello":"world"}');
  });

  it('does not override existing Content-Type or set CSRF on GET', async () => {
    setCookie('csrf_token', 'csrf-abc');
    const { calls } = mockFetchSequence([{ status: 200, body: {} }]);
    await apiClient.put('/foo', { x: 1 });
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-CSRF-Token')).toBe('csrf-abc');
  });

  it('returns text body when content-type is not JSON', async () => {
    mockFetchSequence([{ status: 200, body: 'plain', contentType: 'text/plain' }]);
    const data = await apiClient.get('/foo');
    expect(data).toBe('plain');
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetchSequence([{ status: 204 }]);
    const data = await apiClient.get('/foo');
    expect(data).toBeUndefined();
  });

  it('throws ApiError on non-2xx with error message from payload', async () => {
    mockFetchSequence([{ status: 400, body: { error: 'bad input' } }]);
    await expect(apiClient.get('/foo')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'bad input',
    });
  });

  it('refreshes access token on 401 and retries the original request', async () => {
    setCookie('csrf_token', 'csrf-1');
    // 1) initial 401, 2) /auth/refresh ok, 3) retry ok
    const { fn, calls } = mockFetchSequence([
      { status: 401, body: { error: 'no' } },
      { status: 200, body: { success: true } },
      { status: 200, body: { ok: 'after-refresh' } },
    ]);
    const data = await apiClient.get('/protected');
    expect(data).toEqual({ ok: 'after-refresh' });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(calls[1].url).toBe('/api/auth/refresh');
    expect((calls[1].init as RequestInit).method).toBe('POST');
    expect(calls[2].url).toBe('/api/protected');
  });

  it('dispatches auth:unauthorized and throws when refresh fails', async () => {
    setCookie('csrf_token', 'csrf-1');
    mockFetchSequence([
      { status: 401, body: { error: 'no' } },
      { status: 401, body: { error: 'refresh failed' } },
    ]);
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);
    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:unauthorized', listener);
  });

  it('reuses a single in-flight refresh across concurrent 401s', async () => {
    setCookie('csrf_token', 'csrf-1');
    let refreshCalls = 0;
    const queue: Array<() => Response> = [];
    const enqueue = (r: () => Response) => queue.push(r);
    const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

    // First two 401s (one per concurrent request), then refresh, then two retries
    enqueue(() => new Response(null, { status: 401 }));
    enqueue(() => new Response(null, { status: 401 }));
    enqueue(() => {
      refreshCalls += 1;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'content-length': '1' },
      });
    });
    enqueue(() => new Response(JSON.stringify({ ok: 'a' }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '1' },
    }));
    enqueue(() => new Response(JSON.stringify({ ok: 'b' }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '1' },
    }));

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        // Hold refresh until first 401 has landed
        await wait(20);
      }
      const next = queue.shift();
      if (!next) throw new Error('unexpected fetch call');
      return next();
    }));

    const [a, b] = await Promise.all([apiClient.get('/a'), apiClient.get('/b')]);
    expect([a, b].sort()).toEqual([{ ok: 'a' }, { ok: 'b' }].sort());
    expect(refreshCalls).toBe(1);
  });

  it('wraps network errors as ApiError with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    await expect(apiClient.get('/foo')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: 'Failed to fetch',
    });
  });

  it('ApiError exposes status and data', () => {
    const e = new ApiError('boom', 418, { reason: 'teapot' });
    expect(e.name).toBe('ApiError');
    expect(e.status).toBe(418);
    expect(e.data).toEqual({ reason: 'teapot' });
  });
});
