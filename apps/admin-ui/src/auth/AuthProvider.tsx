/**
 * Authentication context provider for the admin UI.
 * Manages JWT tokens, login/logout, and auto-refresh.
 * @module admin-ui/auth/AuthProvider
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthState | null>(null);

const API_BASE = '/api';

/**
 * Auth provider that wraps the app and manages JWT lifecycle.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('sc_access_token'),
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem('sc_refresh_token'),
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('sc_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Handle SSO callback tokens from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackAccess = params.get('accessToken');
    const callbackRefresh = params.get('refreshToken');

    if (callbackAccess && callbackRefresh) {
      setAccessToken(callbackAccess);
      setRefreshToken(callbackRefresh);
      localStorage.setItem('sc_access_token', callbackAccess);
      localStorage.setItem('sc_refresh_token', callbackRefresh);

      // Decode user from JWT payload
      try {
        const payload = JSON.parse(atob(callbackAccess.split('.')[1]));
        const u: AuthUser = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          tenantId: payload.tenantId,
        };
        setUser(u);
        localStorage.setItem('sc_user', JSON.stringify(u));
      } catch { /* ignore decode errors */ }

      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? 'Login failed');
      }

      const { accessToken: at, refreshToken: rt, user: u } = data.data;
      setAccessToken(at);
      setRefreshToken(rt);
      setUser(u);
      localStorage.setItem('sc_access_token', at);
      localStorage.setItem('sc_refresh_token', rt);
      localStorage.setItem('sc_user', JSON.stringify(u));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (refreshToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }

    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('sc_access_token');
    localStorage.removeItem('sc_refresh_token');
    localStorage.removeItem('sc_user');
  }, [refreshToken]);

  const getAccessToken = useCallback(() => accessToken, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        refreshToken,
        user,
        isAuthenticated: !!accessToken,
        isLoading,
        login,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to access auth state and methods */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
