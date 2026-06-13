// Auth state management with Zustand - dual mode (mock/api) support

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginRequest, RegisterRequest } from '@/types';
import { STORAGE_KEYS, API_MODE } from '@/lib/constants';
import { mockUser } from '@/lib/mock-data';
import { authApi } from '@/lib/api-client';

const apiMode = API_MODE;

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
  loginWithCredentials: (user: User, token: string, refreshToken: string) => void;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// Helper: set/clear auth cookie for Next.js middleware
function setAuthCookie(authenticated: boolean) {
  if (typeof document !== 'undefined') {
    document.cookie = `deepagent_authenticated=${authenticated ? 'true' : ''}; path=/; max-age=${authenticated ? 86400 : 0}; SameSite=Lax`;
  }
}

// In mock mode, default to logged-in state with mock user
const mockDefaults = {
  user: mockUser,
  token: 'mock-jwt-token-demo',
  isAuthenticated: true,
  hasRehydrated: false,
};

// In API mode, start unauthenticated
const apiDefaults = {
  user: null,
  token: null,
  isAuthenticated: false,
  hasRehydrated: false,
};

const defaults = apiMode === 'mock' ? mockDefaults : apiDefaults;

// Check if a token is a mock token (should not be used in API mode)
function isMockToken(token: string | null): boolean {
  return token === 'mock-jwt-token-demo';
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
      ...defaults,
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
        if (apiMode === 'mock') {
          // Mock mode: simulate login with mock user
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'mock-jwt-token-demo');
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'mock-refresh-token');
          }
          set({
            user: mockUser,
            token: 'mock-jwt-token-demo',
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setAuthCookie(true);
          return;
        }

        // API mode: call real login endpoint
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(data);
          const { accessToken, refreshToken, username, email, role } = response.data.data;
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
          }
          set({
            user: { id: '', username, email, role: normalizeRole(role), createdAt: new Date().toISOString() },
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setAuthCookie(true);
        } catch (error) {
          const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Login failed. Please try again.';
          set({ error: message, isLoading: false });
        }
      },

      // Keep the original login method for backward compatibility (mock mode direct set)
      loginWithCredentials: (user, token, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        }
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        setAuthCookie(true);
      },

      register: async (data: RegisterRequest) => {
        if (apiMode === 'mock') {
          // Mock mode: simulate registration with mock user
          const newUser: User = {
            id: `user-${Date.now()}`,
            username: data.username,
            email: data.email,
            role: 'user',
            createdAt: new Date().toISOString(),
          };
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'mock-jwt-token-demo');
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'mock-refresh-token');
          }
          set({
            user: newUser,
            token: 'mock-jwt-token-demo',
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setAuthCookie(true);
          return;
        }

        // API mode: call real register endpoint
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(data);
          const { accessToken, refreshToken, username, email, role } = response.data.data;
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
          }
          set({
            user: { id: '', username, email, role: normalizeRole(role), createdAt: new Date().toISOString() },
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          setAuthCookie(true);
        } catch (error) {
          const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Registration failed. Please try again.';
          set({ error: message, isLoading: false });
        }
      },

      logout: async () => {
        if (apiMode === 'api') {
          // API mode: call logout endpoint to invalidate server-side session
          try {
            await authApi.logout();
          } catch {
            // Ignore logout API errors, still clear local state
          }
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
        if (apiMode === 'mock') {
          // Mock mode: already have mock user in state
          return;
        }

        // API mode: fetch current user from /auth/me
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.me();
          const { user } = response.data.data;
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          // Token invalid, clear auth state
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
            localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          }
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
      // When rehydrating from localStorage, validate the persisted state:
      // In API mode, if the stored token is a mock token, clear auth state
      onRehydrateStorage: () => {
        return (state) => {
          if (apiMode === 'api' && state && isMockToken(state.token)) {
            // Clear mock credentials when running in API mode
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            setAuthCookie(false);
            if (typeof window !== 'undefined') {
              localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
              localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
            }
          } else if (apiMode === 'mock' && state && !state.isAuthenticated) {
            // In mock mode, always auto-authenticate if not already
            state.user = mockUser;
            state.token = 'mock-jwt-token-demo';
            state.isAuthenticated = true;
            setAuthCookie(true);
          } else if (state && state.isAuthenticated) {
            // Sync cookie on rehydration
            setAuthCookie(true);
          }
          // Mark rehydration as complete
          if (state) {
            state.hasRehydrated = true;
          }
        };
      },
    }
  )
);
