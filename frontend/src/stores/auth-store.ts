// Auth state management with Zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginRequest, RegisterRequest } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';
import { authApi } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/utils';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hasRehydrated: boolean;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string, refreshToken: string) => void;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  updateProfile: (data: { username?: string; email?: string; avatarUrl?: string }) => Promise<boolean>;
  changePassword: (data: { oldPassword: string; newPassword: string }) => Promise<boolean>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// Helper: set/clear the auth cookie read by the Next.js middleware.
//
// This cookie is a NON-HttpOnly, client-written UX gate only — anyone can set
// it from the browser console. It exists so the middleware can redirect
// unauthenticated visitors early; real enforcement is the JWT check in
// api-gateway. Never treat it as a security boundary.
function setAuthCookie(authenticated: boolean) {
  if (typeof document !== 'undefined') {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    // Set to strict to prevent CSRF via cookie-based auth
    const sameSite = '; SameSite=Strict';
    const maxAge = authenticated ? '; max-age=86400' : '; max-age=0';
    document.cookie = `deepagent_authenticated=${authenticated ? 'true' : ''}; path=/${maxAge}${sameSite}${secure}`;
  }
}

// Normalize role from backend (uppercase) to frontend (lowercase)
function normalizeRole(role: string): 'user' | 'admin' {
  const lower = role?.toLowerCase() ?? '';
  if (lower === 'admin') return 'admin';
  return 'user';
}

// AuthResponse carries no user id, so the username is the stable identifier.
function userFromAuthResponse(payload: {
  username: string;
  email?: string | null;
  role?: string | null;
}): User {
  return {
    id: payload.username,
    username: payload.username,
    email: payload.email ?? '',
    role: normalizeRole(payload.role ?? 'USER'),
    createdAt: new Date().toISOString(),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasRehydrated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),

      setToken: (token, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        }
        set({ token });
      },

      login: async (data: LoginRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(data);
          const { accessToken, refreshToken, username, email, role } = response.data.data;
          if (typeof window !== 'undefined' && accessToken) {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
            if (refreshToken) {
              localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
            }
          }
          set({
            user: userFromAuthResponse({ username, email, role }),
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setAuthCookie(true);
        } catch (error) {
          set({ error: getErrorMessage(error, '登录失败，请重试。'), isLoading: false });
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(data);
          const { accessToken, refreshToken, username, email, role } = response.data.data;
          if (typeof window !== 'undefined' && accessToken) {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
            if (refreshToken) {
              localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
            }
          }
          set({
            user: userFromAuthResponse({ username, email, role }),
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setAuthCookie(true);
        } catch (error) {
          set({ error: getErrorMessage(error, '注册失败，请重试。'), isLoading: false });
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore logout API errors, still clear local state
        }

        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        }
        setAuthCookie(false);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      fetchCurrentUser: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.me();
          const { username, email, role } = response.data.data;
          // Sync token from localStorage (may have been refreshed by interceptor)
          const currentToken = typeof window !== 'undefined'
            ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
            : null;
          set({
            user: userFromAuthResponse({ username, email, role }),
            token: currentToken ?? get().token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token invalid, clear auth state
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
            localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          }
          setAuthCookie(false);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.updateProfile(data);
          const payload = response.data.data as
            | { username?: string; email?: string; role?: string }
            | null;
          const current = get().user;
          set({
            user: current
              ? {
                  ...current,
                  username: payload?.username ?? data.username ?? current.username,
                  email: payload?.email ?? data.email ?? current.email,
                  role: payload?.role ? normalizeRole(payload.role) : current.role,
                }
              : current,
            isLoading: false,
          });
          return true;
        } catch (error) {
          set({ error: getErrorMessage(error, '保存资料失败'), isLoading: false });
          return false;
        }
      },

      changePassword: async (data) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.changePassword(data);
          set({ isLoading: false });
          return true;
        } catch (error) {
          set({ error: getErrorMessage(error, '修改密码失败'), isLoading: false });
          return false;
        }
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'deepagent-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error || !state) return;

          const hasToken = Boolean(state.token && state.isAuthenticated);
          setAuthCookie(hasToken);

          // Notify subscribers through the store setter rather than mutating the
          // passed-in object (mutation left useSyncExternalStore unaware).
          // Deferred because rehydration runs while the store is still being
          // created, before `useAuthStore` is assigned.
          queueMicrotask(() => {
            useAuthStore.setState({
              user: hasToken ? state.user : null,
              isAuthenticated: hasToken,
              hasRehydrated: true,
            });
          });
        };
      },
    }
  )
);
