import { create } from 'zustand';

function getStoredValue(key: string): string | null {
  const storage = globalThis.localStorage;
  if (!storage || typeof storage.getItem !== 'function') {
    return null;
  }

  return storage.getItem(key);
}

function setStoredValue(key: string, value: string) {
  const storage = globalThis.localStorage;
  if (storage && typeof storage.setItem === 'function') {
    storage.setItem(key, value);
  }
}

function removeStoredValue(key: string) {
  const storage = globalThis.localStorage;
  if (storage && typeof storage.removeItem === 'function') {
    storage.removeItem(key);
  }
}

interface AdminAuthState {
  token: string | null;
  userId: string | null;
  isLoggedIn: boolean;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: getStoredValue('admin_token'),
  userId: getStoredValue('admin_userId'),
  isLoggedIn: !!getStoredValue('admin_token'),
  setAuth: (token: string, userId: string) => {
    setStoredValue('admin_token', token);
    setStoredValue('admin_userId', userId);
    set({ token, userId, isLoggedIn: true });
  },
  clearAuth: () => {
    removeStoredValue('admin_token');
    removeStoredValue('admin_userId');
    set({ token: null, userId: null, isLoggedIn: false });
  },
}));
