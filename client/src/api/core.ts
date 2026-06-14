// fallow-ignore-file security-sink
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const REFRESH_TIMEOUT_MS = 10000;

let refreshPromise: Promise<boolean> | null = null;
let unauthorizedDispatched = false;

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? match[1] : null;
}

async function refreshAccessToken(): Promise<boolean> {
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

    if (!response.ok) return false;

    const data = await response.json();
    if (data.success) {
      if (data.data?.user) {
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      unauthorizedDispatched = false;
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

async function getRefreshedSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

type FetchResult =
  | { response: Response; retried: false; refreshFailed?: false }
  | { response: Response; retried: true; refreshFailed?: false }
  | { response: Response; retried: false; refreshFailed: true };

async function executeWithRefresh(
  url: string,
  config: RequestInit,
  method: string,
  headers: Headers,
): Promise<FetchResult> {
  const response = await fetch(url, config);
  if (response.status !== 401) {
    return { response, retried: false };
  }

  const refreshed = await getRefreshedSession();
  if (!refreshed) {
    return { response, retried: false, refreshFailed: true };
  }

  const newCsrfToken = getCsrfToken();
  if (newCsrfToken && !SAFE_METHODS.has(method)) {
    headers.set('X-CSRF-Token', newCsrfToken);
  }

  const retryResponse = await fetch(url, { ...config, headers });
  return { response: retryResponse, retried: true };
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
