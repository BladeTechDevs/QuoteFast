'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { apiClient, setTokens, clearTokens, getAccessToken } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  plan: 'FREE' | 'PRO' | 'TEAM' | 'BUSINESS';
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from token on mount
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiClient
      .get<User>('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => clearTokens())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/login', { email, password });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { data } = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('/auth/register', { name, email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore — clear tokens regardless
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
