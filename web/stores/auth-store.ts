import { create } from 'zustand';

interface AuthState {
  token: string | null;
  userId: string | null;
  isLoggedIn: boolean;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId'),
  isLoggedIn: !!localStorage.getItem('token'),
  setAuth: (token: string, userId: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    set({ token, userId, isLoggedIn: true });
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    set({ token: null, userId: null, isLoggedIn: false });
  },
}));
