import { PropsWithChildren } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getUnreadCount } from './apis/notification'
import { useAuthStore } from './stores/auth-store'
import './app.scss'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

/** 更新 TabBar 未读角标 */
async function updateTabBarBadge() {
  try {
    const { count } = await getUnreadCount()
    if (count > 0) {
      Taro.setTabBarBadge({ index: 2, text: count > 99 ? '99+' : String(count) })
    } else {
      Taro.removeTabBarBadge({ index: 2 })
    }
  } catch {
    // 静默失败
  }
}

function App({ children }: PropsWithChildren) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  useDidShow(() => {
    if (isLoggedIn) {
      updateTabBarBadge()
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

export default App
