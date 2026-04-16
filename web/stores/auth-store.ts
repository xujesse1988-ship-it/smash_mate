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

interface AuthState {
  token: string | null;
  userId: string | null;
  isLoggedIn: boolean;
  coachMode: boolean;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
  setCoachMode: (enabled: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredValue('token'),
  userId: getStoredValue('userId'),
  isLoggedIn: !!getStoredValue('token'),
  coachMode: getStoredValue('coachMode') === 'true',
  setAuth: (token: string, userId: string) => {
    setStoredValue('token', token);
    setStoredValue('userId', userId);
    set({ token, userId, isLoggedIn: true });
  },
  clearAuth: () => {
    removeStoredValue('token');
    removeStoredValue('userId');
    removeStoredValue('coachMode');
    set({ token: null, userId: null, isLoggedIn: false, coachMode: false });
  },
  setCoachMode: (enabled: boolean) => {
    if (enabled) {
      setStoredValue('coachMode', 'true');
    } else {
      removeStoredValue('coachMode');
    }
    set({ coachMode: enabled });
  },
}));
