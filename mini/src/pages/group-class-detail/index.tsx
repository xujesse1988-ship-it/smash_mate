import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getGroupClassDetail,
  enrollGroupClass,
  cancelEnrollment,
  type GroupClassDetail,
} from '../../apis/coaching'
import ReviewModal from '../../shared/ReviewModal'
import { requestSubscribe } from '../../utils/subscribe'
import styles from './index.module.scss'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<
  GroupClassDetail['status'],
  { label: string; className: string }
> = {
  open: { label: '报名中', className: styles.statusOpen },
  full: { label: '已满员', className: styles.statusFull },
  in_progress: { label: '进行中', className: styles.statusInProgress },
  completed: { label: '已结束', className: styles.statusCompleted },
  cancelled: { label: '已取消', className: styles.statusCancelled },
}

const DISABLED_STATUS_TEXT: Partial<Record<GroupClassDetail['status'], string>> = {
  full: '已满员',
  in_progress: '课程进行中',
  completed: '课程已结束',
  cancelled: '课程已取消',
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

export default function GroupClassDetailPage() {
  const { id } = Taro.getCurrentInstance().router?.params || {}
  const queryClient = useQueryClient()
  const [reviewVisible, setReviewVisible] = useState(false)

  const {
    data: groupClass,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['groupClassDetail', id],
    queryFn: () => getGroupClassDetail(id!),
    enabled: !!id,
  })

  const refreshDetail = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['groupClassDetail', id] })
  }, [queryClient, id])

  // --- Action handlers ---

  const handleEnroll = useCallback(async () => {
    if (!id) return
    try {
      await enrollGroupClass(id)
      await requestSubscribe(['groupClassUpdate'])
      Taro.showToast({ title: '报名成功', icon: 'success' })
      refreshDetail()
    } catch (err) {
      const e = err as Error
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }, [id, refreshDetail])

  const handleCancelEnrollment = useCallback(() => {
    if (!id) return
    Taro.showModal({
      title: '取消报名',
      content: '确定要取消报名吗？',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await cancelEnrollment(id)
            Taro.showToast({ title: '已取消报名', icon: 'success' })
            refreshDetail()
          } catch (err) {
            const e = err as Error
            Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
          }
        }
      },
    })
  }, [id, refreshDetail])

  // --- Navigate to coach detail ---

  const navigateToCoach = useCallback(
    (coachId: string) => {
      Taro.navigateTo({ url: `/pages/coach-detail/index?id=${coachId}` })
    },
    [],
  )

  // --- Render states ---

  if (!id) {
    return (
      <View className={styles.container}>
        <Text className={styles.errorText}>无效的团课</Text>
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
    return (
      <View className={styles.container}>
        <Text className={styles.errorText}>加载失败，请返回重试</Text>
      </View>
    )
  }

  if (!groupClass) return null

  // --- Derived state ---

  const currentUserId = Taro.getStorageSync('userId') || null
  const isEnrolled = groupClass.enrollments.some((e) => e.userId === currentUserId)
  const status = STATUS_MAP[groupClass.status] || STATUS_MAP.open

  return (
    <View className={styles.container}>
      {/* Info card */}
      <View className={styles.card}>
        {/* Status + title */}
        <View className={styles.titleRow}>
          <Text className={`${styles.statusTag} ${status.className}`}>
            {status.label}
          </Text>
          <Text className={styles.title}>{groupClass.title}</Text>
        </View>

        {/* Coach info */}
        {groupClass.coach && (
          <View
            className={styles.coachRow}
            onClick={() => navigateToCoach(groupClass.coachId)}
          >
            {groupClass.coach.avatarUrl ? (
              <Image
                className={styles.coachAvatarImg}
                src={groupClass.coach.avatarUrl}
                mode='aspectFill'
              />
            ) : (
              <View className={styles.coachAvatarPlaceholder}>
                <Text>{groupClass.coach.nickname.charAt(0)}</Text>
              </View>
            )}
            <View className={styles.coachInfo}>
              <Text className={styles.coachName}>{groupClass.coach.nickname}</Text>
              <Text className={styles.coachLabel}>教练</Text>
            </View>
            <Text className={styles.coachArrow}>{'>'}</Text>
          </View>
        )}

        {/* Info rows */}
        <View className={styles.infoSection}>
          {/* Venue */}
          {groupClass.venue && (
            <View className={styles.infoRow}>
              <Text className={styles.infoIcon}>📍</Text>
              <View className={styles.infoContent}>
                <Text className={styles.infoMain}>{groupClass.venue.name}</Text>
                {groupClass.venue.address && (
                  <Text className={styles.infoSub}>{groupClass.venue.address}</Text>
                )}
              </View>
            </View>
          )}

          {/* Time */}
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>🕐</Text>
            <View className={styles.infoContent}>
              <Text className={styles.infoMain}>{formatDate(groupClass.startTime)}</Text>
              <Text className={styles.infoSub}>
                {formatTime(groupClass.startTime)} - {formatTime(groupClass.endTime)}
              </Text>
            </View>
          </View>

          {/* Participant count */}
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>👥</Text>
            <View className={styles.infoContent}>
              <Text className={styles.participantCount}>
                <Text className={styles.participantCountHighlight}>
                  {groupClass.currentParticipants}
                </Text>
                <Text className={styles.participantCountMax}>
                  {' '}/ {groupClass.maxParticipants} 人
                </Text>
              </Text>
            </View>
          </View>

          {/* Fee */}
          {groupClass.feeDescription && (
            <View className={styles.infoRow}>
              <Text className={styles.infoIcon}>💰</Text>
              <View className={styles.infoContent}>
                <Text className={styles.infoMain}>{groupClass.feeDescription}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Enrollment list card */}
      <View className={styles.enrollmentCard}>
        <Text className={styles.sectionTitle}>
          报名学员 ({groupClass.enrollments.length})
        </Text>
        {groupClass.enrollments.length === 0 ? (
          <Text className={styles.emptyEnrollments}>暂无学员报名</Text>
        ) : (
          <View className={styles.avatarList}>
            {groupClass.enrollments.map((enrollment) => (
              <View key={enrollment.userId} className={styles.enrollmentItem}>
                {enrollment.avatarUrl ? (
                  <Image
                    className={styles.enrollmentAvatarImg}
                    src={enrollment.avatarUrl}
                    mode='aspectFill'
                  />
                ) : (
                  <View className={styles.enrollmentAvatarPlaceholder}>
                    <Text>{enrollment.nickname.charAt(0)}</Text>
                  </View>
                )}
                <Text className={styles.enrollmentName}>{enrollment.nickname}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Status-specific notices */}
      {groupClass.status === 'in_progress' && (
        <View className={styles.noticeInProgress}>
          <Text>课程进行中</Text>
        </View>
      )}

      {groupClass.status === 'cancelled' && (
        <View className={styles.noticeCancelled}>
          <Text>该团课已取消</Text>
        </View>
      )}

      {/* Bottom action bar */}
      <View className={styles.bottomBar}>
        {/* Not enrolled + open -> enroll */}
        {!isEnrolled && groupClass.status === 'open' && (
          <Button className={styles.btnEnroll} onClick={handleEnroll}>
            我要报名
          </Button>
        )}

        {/* Enrolled + open/full -> cancel enrollment */}
        {isEnrolled &&
          (groupClass.status === 'open' || groupClass.status === 'full') && (
            <Button className={styles.btnCancel} onClick={handleCancelEnrollment}>
              取消报名
            </Button>
          )}

        {/* Full + not enrolled -> disabled */}
        {!isEnrolled && groupClass.status === 'full' && (
          <Button className={styles.btnDisabled} disabled>
            已满员
          </Button>
        )}

        {/* Other non-actionable states for non-enrolled users */}
        {!isEnrolled &&
          groupClass.status !== 'open' &&
          groupClass.status !== 'full' &&
          DISABLED_STATUS_TEXT[groupClass.status] && (
            <Button className={styles.btnDisabled} disabled>
              {DISABLED_STATUS_TEXT[groupClass.status]}
            </Button>
          )}

        {/* Enrolled + completed -> review coach */}
        {isEnrolled && groupClass.status === 'completed' && (
          <Button
            className={styles.btnEnroll}
            onClick={() => setReviewVisible(true)}
          >
            评价教练
          </Button>
        )}

        {/* Enrolled but non-actionable states (excluding completed which shows review button) */}
        {isEnrolled &&
          groupClass.status !== 'open' &&
          groupClass.status !== 'full' &&
          groupClass.status !== 'completed' &&
          DISABLED_STATUS_TEXT[groupClass.status] && (
            <Button className={styles.btnDisabled} disabled>
              {DISABLED_STATUS_TEXT[groupClass.status]}
            </Button>
          )}
      </View>

      {/* Review modal */}
      {groupClass.coach && (
        <ReviewModal
          visible={reviewVisible}
          coachId={groupClass.coachId}
          sourceType='group-class'
          sourceId={groupClass.id}
          onClose={() => setReviewVisible(false)}
          onSuccess={() => {
            setReviewVisible(false)
            refreshDetail()
          }}
        />
      )}
    </View>
  )
}
