import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';

export function LogoutPage() {
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    clearAuth();
  }, [clearAuth]);

  return <Navigate to="/login" replace />;
}
