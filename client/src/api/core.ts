const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const REFRESH_TIMEOUT_MS = 10000;
const REFRESH_LOCK_NAME = 'auth-refresh';
const REFRESH_RACE_CODE = 'REFRESH_RACE';
const RACE_SETTLE_TIMEOUT_MS = 3000;
const RACE_SETTLE_POLL_MS = 50;

let refreshPromise: Promise<boolean> | null = null;
let unauthorizedDispatched = false;

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? match[1] : null;
}

/**
 * A concurrent refresh (another tab, a retry) rotated the token first. The
 * server leaves our cookies alone in that case and the winner's response
 * carries the fresh ones.
 */
async function isRefreshRace(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const data = await response.json();
    return data?.code === REFRESH_RACE_CODE;
  } catch {
    return false;
  }
}

/**
 * After a lost race, the winner's response may still be in flight: wait until
 * its fresh cookies land (every refresh plants a new csrf_token) before the
 * original request is retried. If they never do, nobody in this browser got
 * the successor token, so the refresh failed — the ensuing logout presents
 * our stale token, which lets the server kill the successor branch.
 * Only meaningful without Web Locks: under the lock no other refresh of this
 * browser can be in flight, so nothing would ever land.
 */
async function waitForNewCsrfCookie(previous: string | null): Promise<boolean> {
  for (let waited = 0; waited < RACE_SETTLE_TIMEOUT_MS; waited += RACE_SETTLE_POLL_MS) {
    const current = getCsrfToken();
    if (current && current !== previous) return true;
    await new Promise((resolve) => setTimeout(resolve, RACE_SETTLE_POLL_MS));
  }
  const current = getCsrfToken();
  return current !== null && current !== previous;
}

async function refreshAccessToken(awaitRaceWinner: boolean): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return awaitRaceWinner && (await isRefreshRace(response)) ? waitForNewCsrfCookie(csrfToken) : false;
    }

    const data = await response.json();
    if (data.success) {
      if (data.data?.user) {
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  public status?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public data?: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function buildUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

function applyDefaultHeaders(headers: Headers, options: RequestInit): void {
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
}

function applyCsrfHeader(headers: Headers, method: string): void {
  if (SAFE_METHODS.has(method)) return;
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }
}

function buildRequestConfig(endpoint: string, options: RequestInit): { url: string; config: RequestInit; method: string } {
  const url = buildUrl(endpoint);
  const method = (options.method || 'GET').toUpperCase();

  const headers = new Headers(options.headers);
  applyDefaultHeaders(headers, options);
  applyCsrfHeader(headers, method);

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers,
  };

  return { url, config, method };
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  if (response.headers.get('content-length') === '0') return undefined;

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function dispatchUnauthorizedEvent(): void {
  if (unauthorizedDispatched) return;
  unauthorizedDispatched = true;
  const event = new CustomEvent('auth:unauthorized', {
    detail: {
      originalPath: window.location.pathname,
      reason: 'session_expired' as const,
    },
  });
  window.dispatchEvent(event);
}

/**
 * Serialize refreshes across tabs: they share the cookie jar, so two tabs
 * rotating the same refresh token at once would make the server see a reuse.
 * Every refresh plants a new csrf_token cookie, so if a new one appeared since
 * the failed request was sent (`csrfAtRequest`), another tab already rotated
 * the session and its fresh cookies are ours too — retrying the original
 * request is enough. A cleared cookie (another tab logged out) is not a
 * refresh: we refresh ourselves and let the server decide.
 * Without the Web Locks API, falls back to a per-tab refresh.
 */
async function refreshAcrossTabs(csrfAtRequest: string | null): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return refreshAccessToken(true);

  return locks.request(REFRESH_LOCK_NAME, async () => {
    const csrfNow = getCsrfToken();
    if (csrfNow && csrfNow !== csrfAtRequest) return true;
    return refreshAccessToken(false);
  });
}

async function getRefreshedSession(csrfAtRequest: string | null): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAcrossTabs(csrfAtRequest)
      .then((refreshed) => {
        // However the session was renewed (own refresh, another tab, a lost
        // race), a later expiry must be reported again.
        if (refreshed) unauthorizedDispatched = false;
        return refreshed;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

type FetchResult =
  | { response: Response; retried: false; refreshFailed?: false }
  | { response: Response; retried: true; refreshFailed?: false }
  | { response: Response; retried: false; refreshFailed: true };

/**
 * A retry can still get a 401 after a successful renewal: the token version
 * was bumped (role or permission change) after the access token we retry with
 * was minted, e.g. one another tab refreshed just before the change. One more
 * refresh, keyed to the cookies of that retry, picks up the new version.
 */
const MAX_REFRESH_ATTEMPTS = 2;

async function executeWithRefresh(
  url: string,
  config: RequestInit,
  method: string,
  headers: Headers,
): Promise<FetchResult> {
  let csrfAtRequest = getCsrfToken();
  let response = await fetch(url, config);
  let retried = false;

  for (let attempt = 0; response.status === 401 && attempt < MAX_REFRESH_ATTEMPTS; attempt++) {
    const refreshed = await getRefreshedSession(csrfAtRequest);
    if (!refreshed) {
      return { response, retried: false, refreshFailed: true };
    }

    csrfAtRequest = getCsrfToken();
    if (csrfAtRequest && !SAFE_METHODS.has(method)) {
      headers.set('X-CSRF-Token', csrfAtRequest);
    }

    response = await fetch(url, { ...config, headers });
    retried = true;
  }

  return retried ? { response, retried: true } : { response, retried: false };
}

function wrapNetworkError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  throw new ApiError(error instanceof Error ? error.message : 'Unknown network error', 0);
}

async function fetchClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { url, config, method } = buildRequestConfig(endpoint, options);
  const headers = config.headers instanceof Headers ? config.headers : new Headers(config.headers);

  try {
    const result = await executeWithRefresh(url, config, method, headers);

    if ('refreshFailed' in result && result.refreshFailed) {
      dispatchUnauthorizedEvent();
      throw new ApiError('Unauthorized', 401);
    }

    const response = result.response;

    if (response.status === 401) {
      dispatchUnauthorizedEvent();
      throw new ApiError('Unauthorized', 401);
    }

    const data = await readBody(response);

    if (!response.ok) {
      const errorMessage = (data as { error?: string } | undefined)?.error
        || `HTTP error! status: ${response.status}`;
      throw new ApiError(
        errorMessage,
        response.status,
        data,
      );
    }

    return data as T;
  } catch (error) {
    wrapNetworkError(error);
  }
}

function appendQueryParam(searchParams: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v) => searchParams.append(`${key}[]`, String(v)));
  } else {
    searchParams.append(key, String(value));
  }
}

const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined | null | string[] | number[]>) => {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => appendQueryParam(searchParams, key, value));
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return fetchClient<T>(url, { method: 'GET' });
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: <T>(endpoint: string, data?: any) =>
    fetchClient<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put: <T>(endpoint: string, data?: any) =>
    fetchClient<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(endpoint: string) =>
    fetchClient<T>(endpoint, { method: 'DELETE' }),
};

export default apiClient;
