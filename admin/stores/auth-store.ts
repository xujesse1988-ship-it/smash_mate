import { create } from 'zustand';

interface AdminAuthState {
  token: string | null;
  userId: string | null;
  isLoggedIn: boolean;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: localStorage.getItem('admin_token'),
  userId: localStorage.getItem('admin_userId'),
  isLoggedIn: !!localStorage.getItem('admin_token'),
  setAuth: (token: string, userId: string) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_userId', userId);
    set({ token, userId, isLoggedIn: true });
  },
  clearAuth: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_userId');
    set({ token: null, userId: null, isLoggedIn: false });
  },
}));
