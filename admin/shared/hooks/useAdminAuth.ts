import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuthStore } from '../../stores/auth-store';

export function useAdminAuth() {
  const navigate = useNavigate();
  const { isLoggedIn, clearAuth } = useAdminAuthStore();

  const logout = useCallback(() => {
    clearAuth();
    navigate('/login', { replace: true });
  }, [clearAuth, navigate]);

  return { isLoggedIn, logout };
}
