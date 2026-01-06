const envBase = import.meta.env.VITE_API_URL;
export const API_BASE = (envBase && envBase.trim() !== '' ? envBase : '/api/v1').replace(/\/$/, '');

const TOKEN_KEY = 'jwt_access_token';
const REFRESH_TOKEN_KEY = 'jwt_refresh_token';
const REFRESH_ENDPOINT = '/auth/refresh/';

export function getAccessToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setAccessToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function setRefreshToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

export function getRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
}

export function clearTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function hasStoredTokens(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

interface RefreshResponse {
  access: string;
  refresh?: string;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}${REFRESH_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      console.warn(`Token refresh failed with status ${response.status}`);
      return false;
    }

    const data = (await response.json()) as RefreshResponse;
    if (!data.access) {
      console.warn('Token refresh response missing new access token');
      return false;
    }

    setAccessToken(data.access);
    if (data.refresh) {
      setRefreshToken(data.refresh);
    }

    console.log('Access token renewed via refresh token');
    return true;
  } catch (error) {
    console.error('Refreshing access token failed', error);
    return false;
  }
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const loginPath = '/login';
  if (window.location.pathname !== loginPath) {
    window.location.replace(loginPath);
  } else {
    window.location.reload();
  }
}

export class APIError extends Error {
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.path = path;
  }
}

export async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
  refreshAttempted = false
): Promise<T> {
  const { headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders as HeadersInit);
  const isFormData = requestOptions.body instanceof FormData;

  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  const hadToken = Boolean(token);
  const hadRefreshToken = Boolean(refreshToken);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log(`API request ${path}: token present`);
  } else {
    console.log(`API request ${path}: NO TOKEN FOUND`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...requestOptions,
  });

  if (response.status === 401) {
    if (!refreshAttempted && (await refreshAccessToken())) {
      return request(path, options, true);
    }
    const hadAnyTokens = hadToken || hadRefreshToken;
    console.warn(
      `Unauthorized (401) on ${path}. Clearing tokens${hadAnyTokens ? ' and redirecting to login.' : '.'}`
    );
    clearTokens();
    if (hadAnyTokens) {
      redirectToLogin();
    }
    throw new APIError('Unauthorized', 401, path);
  }

  if (response.status === 403) {
    const text = await response.text();
    let detail = 'Access denied';
    try {
      const json = JSON.parse(text);
      if (json.detail) {
        detail = json.detail;
      }
    } catch {
      // Keep default message if response is not JSON
    }
    console.warn(`Forbidden (403) on ${path}: ${detail}`);
    throw new APIError(detail, 403, path);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request ${path} failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function requestBlob(
  path: string,
  options: RequestInit = {},
  refreshAttempted = false
): Promise<Blob> {
  const { headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders as HeadersInit);

  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  const hadToken = Boolean(token);
  const hadRefreshToken = Boolean(refreshToken);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log(`API request ${path}: token present`);
  } else {
    console.log(`API request ${path}: NO TOKEN FOUND`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...requestOptions,
  });

  if (response.status === 401) {
    if (!refreshAttempted && (await refreshAccessToken())) {
      return requestBlob(path, options, true);
    }
    const hadAnyTokens = hadToken || hadRefreshToken;
    console.warn(
      `Unauthorized (401) on ${path}. Clearing tokens${hadAnyTokens ? ' and redirecting to login.' : '.'}`
    );
    clearTokens();
    if (hadAnyTokens) {
      redirectToLogin();
    }
    throw new APIError('Unauthorized', 401, path);
  }

  if (response.status === 403) {
    const text = await response.text();
    let detail = 'Access denied';
    try {
      const json = JSON.parse(text);
      if (json.detail) {
        detail = json.detail;
      }
    } catch {
      // Keep default message if response is not JSON
    }
    console.warn(`Forbidden (403) on ${path}: ${detail}`);
    throw new APIError(detail, 403, path);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request ${path} failed with status ${response.status}`);
  }

  return response.blob();
}
