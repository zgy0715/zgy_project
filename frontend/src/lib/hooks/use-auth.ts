// Authentication hook for DeepAgent platform

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import type { LoginRequest, RegisterRequest } from '@/types';

export function useAuth() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    register: storeRegister,
    logout: storeLogout,
    fetchCurrentUser: storeFetchCurrentUser,
    clearError,
  } = useAuthStore();

  const login = useCallback(
    async (data: LoginRequest) => {
      await storeLogin(data);
      // Only redirect if login succeeded
      if (useAuthStore.getState().isAuthenticated) {
        router.push('/dashboard');
      }
    },
    [storeLogin, router]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      await storeRegister(data);
      // Only redirect if registration succeeded
      if (useAuthStore.getState().isAuthenticated) {
        router.push('/dashboard');
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
