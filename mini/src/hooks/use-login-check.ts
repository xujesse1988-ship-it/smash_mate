import Taro, { useDidShow } from '@tarojs/taro'
import { useAuthStore } from '../stores/auth-store'

/**
 * 页面级登录态守卫
 * 在页面 onShow 时检查登录态，未登录则跳转登录页
 */
export function useLoginCheck() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  useDidShow(() => {
    if (!isLoggedIn) {
      Taro.redirectTo({ url: '/pages/login/index' })
    }
  })

  return isLoggedIn
}
