'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, LoginDto, RegisterDto, AuthResponse, UserRole } from '@monorepo/shared-types';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permissionCode: string) => boolean;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadUser = useCallback(async () => {
    const token = api.getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await api.get<User>('/auth/me');
      setUser(profile);
    } catch {
      api.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Real-time Permission Synchronization via SSE
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let sseTimeout: NodeJS.Timeout;

    const connectSSE = () => {
      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const sseUrl = `${api.getBaseUrl()}/auth/permissions/stream`;
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const currentUser = userRef.current;
            if (!currentUser) return;

            // Check if broadcast targets this user or role
            const affectsRole = !data.role || data.role === currentUser.role;
            const affectsUser = !data.userUuid || data.userUuid === currentUser.user_uuid;

            if (affectsRole || affectsUser) {
              // Immediately refresh user effective permissions
              loadUser();
              window.dispatchEvent(
                new CustomEvent('auth:permissions-updated', { detail: data }),
              );
            }
          } catch {
            // ignore heartbeat or parse errors
          }
        };

        es.onerror = () => {
          es.close();
          // Exponential backoff reconnect
          sseTimeout = setTimeout(connectSSE, 5000);
        };
      } catch {
        sseTimeout = setTimeout(connectSSE, 10000);
      }
    };

    connectSSE();

    return () => {
      if (sseTimeout) clearTimeout(sseTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [loadUser]);

  const redirectByRole = (role: UserRole, permissions: string[] = []) => {
    if (
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.ADMIN ||
      role === UserRole.MODERATOR ||
      permissions.length > 0
    ) {
      router.push('/admin/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  const login = async (dto: LoginDto) => {
    const res = await api.post<AuthResponse>('/auth/login', dto);
    api.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    setUser(res.user);
    redirectByRole(res.user.role, res.user.permissions || []);
  };

  const register = async (dto: RegisterDto) => {
    const res = await api.post<AuthResponse>('/auth/register', dto);
    api.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    setUser(res.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Continue cleanup even if server call errored
    } finally {
      api.clearTokens();
      setUser(null);
      window.location.href = '/login';
    }
  };

  const refreshProfile = async () => {
    await loadUser();
  };

  const permissions = user?.permissions || [];

  const hasPermission = useCallback(
    (code: string): boolean => {
      if (!user) return false;
      if (user.role === UserRole.SUPER_ADMIN) return true;
      const list = user.permissions || [];
      if (list.includes(code)) return true;
      // Master inheritance
      if (list.includes('messaging.manage') && code.startsWith('messaging.')) return true;
      if (list.includes('roles.manage') && code === 'permissions.manage') return true;
      if (code === 'users.read' && list.some((p) => p.startsWith('users.'))) return true;
      return false;
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isAuthenticated: !!user,
        isLoading,
        hasPermission,
        login,
        register,
        logout,
        refreshProfile,
        refreshUser: refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
