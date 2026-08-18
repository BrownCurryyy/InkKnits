import type { AuthTokens } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const TOKEN_STORAGE_KEY = 'inkknits_tokens';

let inMemoryTokens: AuthTokens | null = null;

export function readStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return inMemoryTokens;

  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) {
    return inMemoryTokens;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthTokens>;
    if (parsed.accessToken && parsed.refreshToken) {
      inMemoryTokens = {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
      return inMemoryTokens;
    }
  } catch {
    // ignore malformed localStorage data
  }

  return inMemoryTokens;
}

export function writeStoredTokens(tokens: AuthTokens | null): void {
  inMemoryTokens = tokens;
  if (typeof window === 'undefined') return;

  if (!tokens) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export function getAccessToken(): string | null {
  return readStoredTokens()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return readStoredTokens()?.refreshToken ?? null;
}

async function refreshAccessToken(): Promise<AuthTokens> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Unable to refresh session');
  }

  const data = (await response.json()) as { access_token?: string; refresh_token?: string; token_type?: string };
  const nextTokens: AuthTokens = {
    accessToken: data.access_token ?? '',
    refreshToken: data.refresh_token ?? '',
  };

  writeStoredTokens(nextTokens);
  return nextTokens;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean; retry?: boolean; body?: BodyInit | Record<string, unknown> } = {},
): Promise<T> {
  const { skipAuth = false, retry = true, body, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers ?? {});
  const storedTokens = readStoredTokens();

  if (!skipAuth && storedTokens?.accessToken) {
    headers.set('Authorization', `Bearer ${storedTokens.accessToken}`);
  }

  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const requestBody = body instanceof FormData || body instanceof URLSearchParams || typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    method: requestOptions.method ?? 'GET',
    headers,
    body: requestBody,
  });

  if (response.status === 401 && !skipAuth && retry && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    try {
      await refreshAccessToken();
      return apiFetch<T>(path, { ...options, retry: false });
    } catch {
      writeStoredTokens(null);
      window.location.assign('/login');
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    let detail = 'Request failed';
    try {
      const parsed = JSON.parse(errorText) as { detail?: string };
      detail = parsed.detail ?? detail;
    } catch {
      detail = errorText || detail;
    }

    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function logoutApiCall() {
  return apiFetch('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: getRefreshToken() }),
  });
}
