﻿﻿﻿// Auth state management with Zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginRequest, RegisterRequest } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';
import { authApi } from '@/lib/api-client';

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
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// Helper: set/clear auth cookie for Next.js middleware
// Uses SameSite=Strict for CSRF protection and Secure when available
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
  const lower = role.toLowerCase();
  if (lower === 'admin') return 'admin';
  return 'user';
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
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
          }
          set({
            user: { id: username, username, email, role: normalizeRole(role), createdAt: new Date().toISOString() },
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setAuthCookie(true);
        } catch (error) {
          const message =
            (error as any)?.response?.data?.message ??
            '登录失败，请重试。';
          set({ error: message, isLoading: false });
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(data);
          const { accessToken, refreshToken, username, email, role } = response.data.data;
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
          }
          set({
            user: { id: username, username, email, role: normalizeRole(role), createdAt: new Date().toISOString() },
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setAuthCookie(true);
        } catch (error) {
          const message =
            (error as any)?.response?.data?.message ??
            '注册失败，请重试。';
          set({ error: message, isLoading: false });
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
            user: { id: username, username, email, role: normalizeRole(role), createdAt: new Date().toISOString() },
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
        return (state) => {
          if (state) {
            if (state.token && state.isAuthenticated) {
              setAuthCookie(true);
            } else {
              setAuthCookie(false);
              if (!state.token) {
                state.user = null;
                state.isAuthenticated = false;
              }
            }
            state.hasRehydrated = true;
          }
        };
      },
    }
  )
);
