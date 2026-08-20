import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { apiFetch, API_BASE_URL, writeStoredTokens } from '../api/client';
import type { AuthTokens, JwtPayload, UserRecord } from '../types';

const TOKEN_STORAGE_KEY = 'inkknits_tokens';

function decodeJwtPayload(token: string): JwtPayload {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const decoded = window.atob(padded);
  return JSON.parse(decoded) as JwtPayload;
}

interface AuthContextValue {
  user: UserRecord | null;
  roles: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      const rawTokens = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!rawTokens) {
        setIsLoading(false);
        return;
      }

      // TODO: if the roles array is not present in the JWT claims, fetch the user role payload from
      // the backend RBAC APIs and merge it here before treating the session as fully hydrated.

      try {
        const saved = JSON.parse(rawTokens) as Partial<AuthTokens>;
        if (!saved.accessToken) {
          setIsLoading(false);
          return;
        }

        const payload = decodeJwtPayload(saved.accessToken);
        const resolvedRoles = payload.roles ?? [];

        const me = await apiFetch<UserRecord>('/auth/me');
        setUser(me);
        setRoles(resolvedRoles.length ? resolvedRoles : ['VIEWER']);
      } catch {
        writeStoredTokens(null);
        setUser(null);
        setRoles([]);
      } finally {
        setIsLoading(false);
      }
    };

    void hydrate();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });

    const nextTokens: AuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };

    writeStoredTokens(nextTokens);

    const payload = decodeJwtPayload(nextTokens.accessToken);
    const me = await apiFetch<UserRecord>('/auth/me');
    setUser(me);
    setRoles(payload.roles ?? ['VIEWER']);
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refresh_token: JSON.parse(window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? '{}').refreshToken ?? null,
        }),
      });
    } catch {
      // ignore logout error and force local cleanup
    } finally {
      writeStoredTokens(null);
      setUser(null);
      setRoles([]);
      window.location.assign('/login');
    }
  };

  const refreshSession = async () => {
    const stored = JSON.parse(window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? '{}') as Partial<AuthTokens>;
    if (!stored.refreshToken) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: stored.refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Unable to refresh session');
    }

    const data = (await response.json()) as { access_token: string; refresh_token: string };
    writeStoredTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });

    const payload = decodeJwtPayload(data.access_token);
    setRoles(payload.roles ?? ['VIEWER']);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshSession,
    }),
    [user, roles, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
