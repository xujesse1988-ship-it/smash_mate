import Taro from '@tarojs/taro'
import { create } from 'zustand'

interface AuthState {
  token: string | null
  userId: string | null
  isLoggedIn: boolean
  coachMode: boolean
  setAuth: (token: string, userId: string) => void
  clearAuth: () => void
  setCoachMode: (enabled: boolean) => void
}

function getStorage(key: string): string | null {
  try {
    return Taro.getStorageSync(key) || null
  } catch {
    return null
  }
}

function setStorage(key: string, value: string): void {
  try {
    Taro.setStorageSync(key, value)
  } catch {}
}

function removeStorage(key: string): void {
  try {
    Taro.removeStorageSync(key)
  } catch {}
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStorage('token'),
  userId: getStorage('userId'),
  isLoggedIn: !!getStorage('token'),
  coachMode: getStorage('coachMode') === 'true',

  setAuth: (token, userId) => {
    setStorage('token', token)
    setStorage('userId', userId)
    set({ token, userId, isLoggedIn: true })
  },

  clearAuth: () => {
    removeStorage('token')
    removeStorage('userId')
    set({ token: null, userId: null, isLoggedIn: false })
  },

  setCoachMode: (enabled) => {
    setStorage('coachMode', String(enabled))
    set({ coachMode: enabled })
  },
}))
