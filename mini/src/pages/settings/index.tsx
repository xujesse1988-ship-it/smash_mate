import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button, Dialog } from '@nutui/nutui-react-taro'
import { useAuthStore } from '../../stores/auth-store'
import styles from './index.module.scss'

const APP_VERSION = 'v1.0.0'

export default function SettingsPage() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  function handleLogout() {
    setShowLogoutConfirm(false)
    clearAuth()
    Taro.redirectTo({ url: '/pages/login/index' })
  }

  return (
    <View className={styles.container}>
      {/* Menu */}
      <View className={styles.menuList}>
        <View className={styles.menuItem}>
          <Text>关于我们</Text>
          <Text className={styles.menuValue}>羽约 SmashMate</Text>
        </View>
        <View className={styles.menuDivider} />
        <View className={styles.menuItem}>
          <Text>当前版本</Text>
          <Text className={styles.menuValue}>{APP_VERSION}</Text>
        </View>
      </View>

      {/* Logout */}
      <Button
        block
        className={styles.logoutBtn}
        onClick={() => setShowLogoutConfirm(true)}
        style={{ background: '#ef4444', borderColor: '#ef4444', color: '#ffffff' }}
      >
        退出登录
      </Button>

      <Text className={styles.versionText}>{APP_VERSION}</Text>

      {/* Logout confirm dialog */}
      <Dialog
        title="提示"
        visible={showLogoutConfirm}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      >
        确定退出登录？
      </Dialog>
    </View>
  )
}
