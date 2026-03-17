const envBase = import.meta.env.VITE_API_URL;
export const API_BASE = (envBase && envBase.trim() !== '' ? envBase : '/api/v1').replace(
  /\/$/,
  '',
);
const API_DEBUG = import.meta.env.DEV && import.meta.env.VITE_API_DEBUG === 'true';

const TOKEN_KEY = 'jwt_access_token';
const REFRESH_TOKEN_KEY = 'jwt_refresh_token';
const REFRESH_ENDPOINT = '/auth/refresh/';
const LOGIN_PATH = '/login';
const POST_LOGIN_REDIRECT_KEY = 'crm_post_login_redirect';

const debugLog = (...args: unknown[]) => {
  if (API_DEBUG) {
    console.log(...args);
  }
};

const debugWarn = (...args: unknown[]) => {
  if (API_DEBUG) {
    console.warn(...args);
  }
};

const debugError = (...args: unknown[]) => {
  if (API_DEBUG) {
    console.error(...args);
  }
};

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
      debugWarn(`Token refresh failed with status ${response.status}`);
      return false;
    }

    const data = (await response.json()) as RefreshResponse;
    if (!data.access) {
      debugWarn('Token refresh response missing new access token');
      return false;
    }

    setAccessToken(data.access);
    if (data.refresh) {
      setRefreshToken(data.refresh);
    }

    debugLog('Access token renewed via refresh token');
    return true;
  } catch (error) {
    debugError('Refreshing access token failed', error);
    return false;
  }
}

const normalizePostLoginRedirect = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  if (
    value === LOGIN_PATH ||
    value.startsWith(`${LOGIN_PATH}?`) ||
    value.startsWith(`${LOGIN_PATH}#`)
  ) {
    return null;
  }

  return value;
};

const persistPostLoginRedirect = (value: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!value) {
    window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return;
  }

  window.sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, value);
};

const getRedirectFromSearch = (search?: string): string | null => {
  if (!search) {
    return null;
  }

  const query = search.startsWith('?') ? search.slice(1) : search;
  const nextFromQuery = normalizePostLoginRedirect(new URLSearchParams(query).get('next'));
  if (nextFromQuery) {
    return nextFromQuery;
  }
  return null;
};

export function getPostLoginRedirect(search?: string): string | null {
  const nextFromQuery = getRedirectFromSearch(search);
  if (nextFromQuery) {
    return nextFromQuery;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return normalizePostLoginRedirect(window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY));
}

export function consumePostLoginRedirect(search?: string): string | null {
  const nextPath = getPostLoginRedirect(search);
  persistPostLoginRedirect(null);
  return nextPath;
}

export function buildLoginRedirectPath(currentPath?: string | null): string {
  const normalizedTarget = normalizePostLoginRedirect(currentPath);
  if (!normalizedTarget) {
    return LOGIN_PATH;
  }

  return `${LOGIN_PATH}?next=${encodeURIComponent(normalizedTarget)}`;
}

export function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== LOGIN_PATH) {
    const currentPath = normalizePostLoginRedirect(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    persistPostLoginRedirect(currentPath);
    window.location.replace(buildLoginRedirectPath(currentPath));
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

const attachAuthHeader = (headers: Headers, path: string) => {
  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  const hadToken = Boolean(token);
  const hadRefreshToken = Boolean(refreshToken);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    debugLog(`API request ${path}: token present`);
  } else {
    debugLog(`API request ${path}: NO TOKEN FOUND`);
  }

  return { hadRefreshToken, hadToken };
};

const parseForbiddenDetail = async (response: Response) => {
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
  return detail;
};

export async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
  refreshAttempted = false,
): Promise<T> {
  const { headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders as HeadersInit);
  const isFormData = requestOptions.body instanceof FormData;

  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const { hadRefreshToken, hadToken } = attachAuthHeader(headers, path);

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...requestOptions,
  });

  if (response.status === 401) {
    if (!refreshAttempted && (await refreshAccessToken())) {
      return request(path, options, true);
    }
    const hadAnyTokens = hadToken || hadRefreshToken;
    debugWarn(
      `Unauthorized (401) on ${path}. Clearing tokens${hadAnyTokens ? ' and redirecting to login.' : '.'}`,
    );
    clearTokens();
    redirectToLogin();
    throw new APIError('Unauthorized', 401, path);
  }

  if (response.status === 403) {
    const detail = await parseForbiddenDetail(response);
    debugWarn(`Forbidden (403) on ${path}: ${detail}`);
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
  refreshAttempted = false,
): Promise<Blob> {
  const { headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders as HeadersInit);

  const { hadRefreshToken, hadToken } = attachAuthHeader(headers, path);

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...requestOptions,
  });

  if (response.status === 401) {
    if (!refreshAttempted && (await refreshAccessToken())) {
      return requestBlob(path, options, true);
    }
    const hadAnyTokens = hadToken || hadRefreshToken;
    debugWarn(
      `Unauthorized (401) on ${path}. Clearing tokens${hadAnyTokens ? ' and redirecting to login.' : '.'}`,
    );
    clearTokens();
    if (hadAnyTokens) {
      redirectToLogin();
    }
    throw new APIError('Unauthorized', 401, path);
  }

  if (response.status === 403) {
    const detail = await parseForbiddenDetail(response);
    debugWarn(`Forbidden (403) on ${path}: ${detail}`);
    throw new APIError(detail, 403, path);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request ${path} failed with status ${response.status}`);
  }

  return response.blob();
}

export async function requestBlobWithHeaders(
  path: string,
  options: RequestInit = {},
  refreshAttempted = false,
): Promise<{ blob: Blob; headers: Headers }> {
  const { headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders as HeadersInit);

  const { hadRefreshToken, hadToken } = attachAuthHeader(headers, path);

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...requestOptions,
  });

  if (response.status === 401) {
    if (!refreshAttempted && (await refreshAccessToken())) {
      return requestBlobWithHeaders(path, options, true);
    }
    const hadAnyTokens = hadToken || hadRefreshToken;
    debugWarn(
      `Unauthorized (401) on ${path}. Clearing tokens${hadAnyTokens ? ' and redirecting to login.' : '.'}`,
    );
    clearTokens();
    if (hadAnyTokens) {
      redirectToLogin();
    }
    throw new APIError('Unauthorized', 401, path);
  }

  if (response.status === 403) {
    const detail = await parseForbiddenDetail(response);
    debugWarn(`Forbidden (403) on ${path}: ${detail}`);
    throw new APIError(detail, 403, path);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request ${path} failed with status ${response.status}`);
  }

  return { blob: await response.blob(), headers: response.headers };
}
