// fallow-ignore-file security-sink
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

let refreshPromise: Promise<boolean> | null = null;
let unauthorizedDispatched = false;

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? match[1] : null;
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
  public data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function fetchClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers,
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const refreshed = await refreshPromise;

      if (refreshed) {
        const newCsrfToken = getCsrfToken();
        if (newCsrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
          headers.set('X-CSRF-Token', newCsrfToken);
        }

        const retryResponse = await fetch(url, { ...config, headers });

        if (retryResponse.ok) {
          let retryData;
          if (retryResponse.status !== 204 && retryResponse.headers.get('content-length') !== '0') {
            const contentType = retryResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              retryData = await retryResponse.json();
            } else {
              retryData = await retryResponse.text();
            }
          }
          return retryData;
        }
      }

      if (!unauthorizedDispatched) {
        unauthorizedDispatched = true;
        const event = new CustomEvent('auth:unauthorized', {
          detail: {
            originalPath: window.location.pathname,
            reason: 'session_expired' as const,
          }
        });
        window.dispatchEvent(event);
      }
      throw new ApiError('Unauthorized', 401);
    }

    let data;
    if (response.status !== 204 && response.headers.get('content-length') !== '0') {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    }

    if (!response.ok) {
      throw new ApiError(
        data?.error || `HTTP error! status: ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error instanceof Error ? error.message : 'Unknown network error', 0);
  }
}

export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined | null | string[] | number[]>) => {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(`${key}[]`, String(v)));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return fetchClient<T>(url, { method: 'GET' });
  },
  post: <T>(endpoint: string, data?: any) =>
    fetchClient<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(endpoint: string, data?: any) =>
    fetchClient<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(endpoint: string) =>
    fetchClient<T>(endpoint, { method: 'DELETE' }),
};

export default apiClient;
