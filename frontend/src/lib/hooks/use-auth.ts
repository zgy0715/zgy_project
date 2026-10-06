// Authentication hook for DeepAgent platform

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import type { LoginRequest, RegisterRequest } from '@/types';

export function useAuth() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const storeLogin = useAuthStore((s) => s.login);
  const storeRegister = useAuthStore((s) => s.register);
  const storeLogout = useAuthStore((s) => s.logout);
  const storeFetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const clearError = useAuthStore((s) => s.clearError);

  const login = useCallback(
    async (data: LoginRequest, redirectTo: string = '/dashboard') => {
      await storeLogin(data);
      // Only redirect if login succeeded
      if (useAuthStore.getState().isAuthenticated) {
        router.push(redirectTo);
      }
    },
    [storeLogin, router]
  );

  const register = useCallback(
    async (data: RegisterRequest, redirectTo: string = '/dashboard') => {
      await storeRegister(data);
      // Only redirect if registration succeeded
      if (useAuthStore.getState().isAuthenticated) {
        router.push(redirectTo);
      }
    },
    [storeRegister, router]
  );

  const logout = useCallback(async () => {
    await storeLogout();
    router.push('/auth/login');
  }, [storeLogout, router]);

  const fetchCurrentUser = useCallback(async () => {
    await storeFetchCurrentUser();
  }, [storeFetchCurrentUser]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    fetchCurrentUser,
    clearError,
  };
}
