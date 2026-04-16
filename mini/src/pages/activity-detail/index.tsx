import { useCallback } from 'react'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getActivityDetail,
  joinActivity,
  leaveActivity,
  cancelActivity,
  type ActivityDetail,
} from '../../apis/activity'
import styles from './index.module.scss'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<
  ActivityDetail['status'],
  { label: string; className: string }
> = {
  open: { label: '报名中', className: styles.statusOpen },
  full: { label: '已满', className: styles.statusFull },
  in_progress: { label: '进行中', className: styles.statusInProgress },
  completed: { label: '已结束', className: styles.statusCompleted },
  cancelled: { label: '已取消', className: styles.statusCancelled },
}

const DISABLED_STATUS_TEXT: Partial<Record<ActivityDetail['status'], string>> = {
  full: '已满员',
  in_progress: '活动进行中',
  completed: '活动已结束',
  cancelled: '活动已取消',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[d.getDay()]
  return `${month}月${day}日 周${weekday}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityDetailPage() {
  const { id } = Taro.getCurrentInstance().router?.params || {}
  const queryClient = useQueryClient()

  useShareAppMessage(() => ({
    title: activity?.title || '来一起打球！',
    path: `/pages/activity-detail/index?id=${id}`,
  }))

  const {
    data: activity,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['activityDetail', id],
    queryFn: () => getActivityDetail(id!),
    enabled: !!id,
  })

  const refreshDetail = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['activityDetail', id] })
  }, [queryClient, id])

  // --- Action handlers ---

  const handleJoin = useCallback(async () => {
    if (!id) return
    try {
      await joinActivity(id)
      Taro.showToast({ title: '参加成功', icon: 'success' })
      refreshDetail()
    } catch (err) {
      const e = err as Error
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }, [id, refreshDetail])

  const handleLeave = useCallback(async () => {
    if (!id) return
    try {
      await leaveActivity(id)
      Taro.showToast({ title: '已退出活动', icon: 'success' })
      refreshDetail()
    } catch (err) {
      const e = err as Error
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }, [id, refreshDetail])

  const handleCancel = useCallback(() => {
    if (!id) return
    Taro.showModal({
      title: '取消活动',
      content: '取消后不可恢复，所有参与者将收到通知',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await cancelActivity(id)
            Taro.showToast({ title: '活动已取消', icon: 'success' })
            refreshDetail()
          } catch (err) {
            const e = err as Error
            Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
          }
        }
      },
    })
  }, [id, refreshDetail])

  // --- Render states ---

  if (!id) {
    return (
      <View className={styles.container}>
        <Text className={styles.errorText}>无效的活动</Text>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View className={styles.container}>
        <Text className={styles.loadingText}>加载中...</Text>
      </View>
    )
  }

  if (error) {
    const err = error as Error & { code?: string }
    return (
      <View className={styles.container}>
        <Text className={styles.errorText}>
          {err.code === 'ACTIVITY_NOT_FOUND' ? '活动不存在' : '加载失败，请重试'}
        </Text>
      </View>
    )
  }

  if (!activity) return null

  // --- Derived state ---

  const currentUserId = Taro.getStorageSync('userId') || null
  const isCreator = activity.creator.id === currentUserId
  const isParticipant = activity.isParticipant
  const status = STATUS_MAP[activity.status] || STATUS_MAP.open

  return (
    <View className={styles.container}>
      {/* Info card */}
      <View className={styles.card}>
        {/* Status + title */}
        <View className={styles.titleRow}>
          <Text className={`${styles.statusTag} ${status.className}`}>
            {status.label}
          </Text>
          {activity.title && (
            <Text className={styles.title}>{activity.title}</Text>
          )}
        </View>

        {/* Info rows */}
        <View className={styles.infoSection}>
          {/* Venue */}
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>📍</Text>
            <View className={styles.infoContent}>
              <Text className={styles.infoMain}>
                {activity.venue?.name || '未知场馆'}
              </Text>
              {activity.venue?.address && (
                <Text className={styles.infoSub}>
                  {activity.venue.address}
                </Text>
              )}
            </View>
          </View>

          {/* Time */}
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>🕐</Text>
            <View className={styles.infoContent}>
              <Text className={styles.infoMain}>
                {formatDate(activity.startTime)}
              </Text>
              <Text className={styles.infoSub}>
                {formatTime(activity.startTime)} - {formatTime(activity.endTime)}
              </Text>
            </View>
          </View>

          {/* Participants count */}
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>👥</Text>
            <View className={styles.infoContent}>
              <Text className={styles.participantCount}>
                <Text className={styles.participantCountHighlight}>
                  {activity.currentParticipants}
                </Text>
                <Text className={styles.participantCountMax}>
                  {' '}/ {activity.maxParticipants} 人
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Creator card */}
      <View className={styles.creatorCard}>
        <Text className={styles.sectionTitle}>发起人</Text>
        <View className={styles.creatorRow}>
          {activity.creator.avatarUrl ? (
            <Image
              className={styles.avatarImg}
              src={activity.creator.avatarUrl}
              mode='aspectFill'
            />
          ) : (
            <View className={styles.avatarPlaceholder}>
              <Text>{activity.creator.nickname.charAt(0)}</Text>
            </View>
          )}
          <Text className={styles.creatorName}>
            {activity.creator.nickname}
          </Text>
        </View>
      </View>

      {/* Participants card */}
      <View className={styles.participantsCard}>
        <Text className={styles.sectionTitle}>参与者</Text>
        {activity.participants.length === 0 ? (
          <Text className={styles.emptyParticipants}>暂无参与者</Text>
        ) : (
          <View className={styles.avatarList}>
            {activity.participants.map((p) => (
              <View key={p.id} className={styles.participantItem}>
                {p.avatarUrl ? (
                  <Image
                    className={styles.participantAvatarImg}
                    src={p.avatarUrl}
                    mode='aspectFill'
                  />
                ) : (
                  <View className={styles.participantAvatarPlaceholder}>
                    <Text>{p.nickname.charAt(0)}</Text>
                  </View>
                )}
                <Text className={styles.participantName}>{p.nickname}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Bottom action bar */}
      <View className={styles.bottomBar}>
        {/* Not participant + open -> join */}
        {!isParticipant && activity.status === 'open' && (
          <Button className={styles.btnJoin} onClick={handleJoin}>
            我要参加
          </Button>
        )}

        {/* Participant + not creator + open/full -> leave */}
        {isParticipant &&
          !isCreator &&
          (activity.status === 'open' || activity.status === 'full') && (
            <Button className={styles.btnLeave} onClick={handleLeave}>
              退出活动
            </Button>
          )}

        {/* Creator + open/full -> cancel */}
        {isCreator &&
          (activity.status === 'open' || activity.status === 'full') && (
            <Button className={styles.btnCancel} onClick={handleCancel}>
              取消活动
            </Button>
          )}

        {/* Disabled states for non-participants */}
        {!isParticipant &&
          activity.status !== 'open' &&
          DISABLED_STATUS_TEXT[activity.status] && (
            <Button className={styles.btnDisabled} disabled>
              {DISABLED_STATUS_TEXT[activity.status]}
            </Button>
          )}

        {/* Disabled states for participants when not actionable */}
        {isParticipant &&
          activity.status !== 'open' &&
          activity.status !== 'full' &&
          DISABLED_STATUS_TEXT[activity.status] && (
            <Button className={styles.btnDisabled} disabled>
              {DISABLED_STATUS_TEXT[activity.status]}
            </Button>
          )}
      </View>
    </View>
  )
}
