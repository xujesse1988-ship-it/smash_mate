import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

/**
 * Shared hook that wraps useAuthStore and provides common auth helpers.
 *
 * - `isLoggedIn` / `userId` / `token`: read-only state from authStore
 * - `logout()`: clears auth state and navigates to /login
 *
 * Design reference: docs/module-design/web-app.md §6 — useAuth hook
 */
export function useAuth() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  function logout() {
    clearAuth();
    navigate('/login');
  }

  return { isLoggedIn, userId, token, logout };
}
