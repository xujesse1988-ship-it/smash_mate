import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { useQuery } from '@tanstack/react-query'
import { getUserProfile, getMatchStats } from '../../apis/user'
import styles from './index.module.scss'

export default function UserProfilePage() {
  const { id } = Taro.getCurrentInstance().router?.params || {}

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ['userProfile', id],
    queryFn: () => getUserProfile(id!),
    enabled: !!id,
  })

  const { data: stats } = useQuery({
    queryKey: ['matchStats', id],
    queryFn: () => getMatchStats(id!),
    enabled: !!id,
  })

  if (!id) {
    return (
      <View className={styles.container}>
        <Text className={styles.errorText}>无效的用户</Text>
      </View>
    )
  }

  if (profileLoading) {
    return (
      <View className={styles.container}>
        <Text className={styles.loadingText}>加载中...</Text>
      </View>
    )
  }

  if (profileError) {
    const err = profileError as Error & { code?: string }
    return (
      <View className={styles.container}>
        <Text className={styles.errorText}>
          {err.code === 'USER_NOT_FOUND' ? '用户不存在' : '加载失败'}
        </Text>
      </View>
    )
  }

  if (!profile) return null

  return (
    <View className={styles.container}>
      {/* User info header */}
      <View className={styles.header}>
        <View className={styles.avatarWrap}>
          {profile.avatarUrl ? (
            <Image className={styles.avatarImg} src={profile.avatarUrl} mode="aspectFill" />
          ) : (
            <View className={styles.avatarPlaceholder}>
              <Text>{profile.nickname?.charAt(0) || '?'}</Text>
            </View>
          )}
        </View>
        <Text className={styles.nickname}>{profile.nickname}</Text>
        {profile.isCoach && <Text className={styles.coachTag}>认证教练</Text>}
        {profile.bio && <Text className={styles.bio}>{profile.bio}</Text>}
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
    </View>
  )
}
