// Authentication hook for DeepAgent platform

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import apiClient from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { LoginRequest, RegisterRequest, AuthResponse, ApiResponse } from '@/types';

export function useAuth() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    logout: storeLogout,
    setLoading,
    setError,
    clearError,
  } = useAuthStore();

  const login = useCallback(
    async (data: LoginRequest) => {
      try {
        setLoading(true);
        clearError();
        const response = await apiClient.post<ApiResponse<AuthResponse>>(
          API_ENDPOINTS.AUTH.LOGIN,
          data
        );
        const { token, refreshToken, user } = response.data.data;
        storeLogin(user, token, refreshToken);
        router.push('/dashboard');
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Login failed. Please try again.';
        setError(message);
      }
    },
    [storeLogin, router, setLoading, setError, clearError]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      try {
        setLoading(true);
        clearError();
        const response = await apiClient.post<ApiResponse<AuthResponse>>(
          API_ENDPOINTS.AUTH.REGISTER,
          data
        );
        const { token, refreshToken, user } = response.data.data;
        storeLogin(user, token, refreshToken);
        router.push('/dashboard');
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Registration failed. Please try again.';
        setError(message);
      }
    },
    [storeLogin, router, setLoading, setError, clearError]
  );

  const logout = useCallback(() => {
    storeLogout();
    router.push('/login');
  }, [storeLogout, router]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<ApiResponse<AuthResponse>>(
        API_ENDPOINTS.AUTH.ME
      );
      const { user } = response.data.data;
      useAuthStore.getState().setUser(user);
    } catch {
      storeLogout();
    }
  }, [setLoading, storeLogout]);

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
