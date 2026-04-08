import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

/**
 * Route-level auth guard. Wraps authenticated routes via `<Outlet />`.
 * Unauthenticated users are redirected to /login.
 *
 * Design reference: docs/module-design/web-app.md §6 — AuthGuard
 */
export function AuthGuard() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
