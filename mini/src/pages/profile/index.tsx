import { View, Text, Image } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useLoginCheck } from '../../hooks/use-login-check'
import { useAuthStore } from '../../stores/auth-store'
import { getMe, getMatchStats } from '../../apis/user'
import styles from './index.module.scss'

export default function ProfilePage() {
  const isLoggedIn = useLoginCheck()
  const userId = useAuthStore((s) => s.userId)

  useShareAppMessage(() => ({
    title: `${userInfo?.nickname || ''} 的羽球战绩`,
    path: `/pages/user-profile/index?id=${userId}`,
  }))

  const {
    data: userInfo,
    isLoading: userLoading,
  } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: isLoggedIn,
  })

  const {
    data: stats,
  } = useQuery({
    queryKey: ['matchStats', userId],
    queryFn: () => getMatchStats(userId!),
    enabled: isLoggedIn && !!userId,
  })

  if (!isLoggedIn) return null

  if (userLoading) {
    return (
      <View className={styles.container}>
        <View className={styles.header}>
          <Text style={{ color: '#999', fontSize: '28px' }}>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className={styles.container}>
      {/* User info header */}
      <View className={styles.header}>
        <View className={styles.avatarWrap}>
          {userInfo?.avatarUrl ? (
            <Image className={styles.avatarImg} src={userInfo.avatarUrl} mode="aspectFill" />
          ) : (
            <View className={styles.avatarPlaceholder}>
              <Text>{userInfo?.nickname?.charAt(0) || '?'}</Text>
            </View>
          )}
        </View>
        <Text className={styles.nickname}>{userInfo?.nickname || '--'}</Text>
        {userInfo?.isCoach && <Text className={styles.coachTag}>认证教练</Text>}
        {userInfo?.bio && <Text className={styles.bio}>{userInfo.bio}</Text>}
      </View>

      {/* Match stats */}
      <View className={styles.statsCard}>
        <Text className={styles.statsTitle}>战绩统计</Text>
        <View className={styles.statsGrid}>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{stats?.totalMatches ?? '-'}</Text>
            <Text className={styles.statLabel}>总场次</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{stats?.wins ?? '-'}</Text>
            <Text className={styles.statLabel}>胜</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{stats?.losses ?? '-'}</Text>
            <Text className={styles.statLabel}>负</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{stats?.draws ?? '-'}</Text>
            <Text className={styles.statLabel}>平</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statValueGreen}>
              {stats ? `${(stats.winRate * 100).toFixed(0)}%` : '-'}
            </Text>
            <Text className={styles.statLabel}>胜率</Text>
          </View>
        </View>
      </View>

      {/* Menu list */}
      <View className={styles.menuList}>
        <View
          className={styles.menuItem}
          onClick={() => Taro.navigateTo({ url: '/pages/profile-edit/index' })}
        >
          <Text>编辑资料</Text>
          <Text className={styles.menuArrow}>{'>'}</Text>
        </View>
        <View className={styles.menuDivider} />
        <View
          className={styles.menuItem}
          onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}
        >
          <Text>设置</Text>
          <Text className={styles.menuArrow}>{'>'}</Text>
        </View>
      </View>
    </View>
  )
}
