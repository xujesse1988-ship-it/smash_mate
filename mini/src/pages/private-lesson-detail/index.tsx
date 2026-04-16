import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getPrivateLessonDetail,
  bookPrivateLesson,
  cancelPrivateLesson,
  getVenueDetail,
  type PrivateLessonDetail,
  type SlotVenue,
} from '../../apis/coaching'
import { getUserProfile } from '../../apis/user'
import styles from './index.module.scss'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<
  PrivateLessonDetail['status'],
  { label: string; className: string }
> = {
  scheduled: { label: '未开始', className: styles.statusScheduled },
  in_progress: { label: '进行中', className: styles.statusInProgress },
  completed: { label: '已结束', className: styles.statusCompleted },
  cancelled: { label: '已取消', className: styles.statusCancelled },
  expired: { label: '已过期', className: styles.statusExpired },
}

const DISABLED_STATUS_TEXT: Partial<Record<PrivateLessonDetail['status'], string>> = {
  in_progress: '课程进行中',
  completed: '课程已结束',
  cancelled: '课程已取消',
  expired: '时段已过期',
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

export default function PrivateLessonDetailPage() {
  const { id } = Taro.getCurrentInstance().router?.params || {}
  const queryClient = useQueryClient()
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)

  // --- Fetch lesson detail ---

  const {
    data: lesson,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['privateLessonDetail', id],
    queryFn: () => getPrivateLessonDetail(id!),
    enabled: !!id,
  })

  // --- Fetch coach profile ---

  const { data: coach } = useQuery({
    queryKey: ['userProfile', lesson?.coachId],
    queryFn: () => getUserProfile(lesson!.coachId),
    enabled: !!lesson?.coachId,
  })

  // --- Fetch student profile (if booked) ---

  const { data: student } = useQuery({
    queryKey: ['userProfile', lesson?.studentId],
    queryFn: () => getUserProfile(lesson!.studentId!),
    enabled: !!lesson?.studentId,
  })

  // --- Resolve venue names for venueIds (slot mode) ---

  const venueIds = lesson?.venueIds ?? []
  const { data: resolvedVenues } = useQuery({
    queryKey: ['venueDetails', venueIds],
    queryFn: async () => {
      const results = await Promise.all(
        venueIds.map((vid) => getVenueDetail(vid).catch(() => null)),
      )
      return results.filter((v): v is SlotVenue => v !== null)
    },
    enabled: venueIds.length > 0 && !lesson?.studentId,
  })

  const refreshDetail = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['privateLessonDetail', id] })
  }, [queryClient, id])

  // --- Action handlers ---

  const handleBook = useCallback(async () => {
    if (!id) return
    const venues = resolvedVenues ?? []
    if (venues.length > 0 && !selectedVenueId) {
      Taro.showToast({ title: '请先选择场馆', icon: 'none' })
      return
    }
    setBooking(true)
    try {
      await bookPrivateLesson(id, selectedVenueId ?? undefined)
      Taro.showToast({ title: '预约成功', icon: 'success' })
      refreshDetail()
    } catch (err) {
      const e = err as Error
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    } finally {
      setBooking(false)
    }
  }, [id, selectedVenueId, resolvedVenues, refreshDetail])

  const handleCancel = useCallback(() => {
    if (!id) return
    Taro.showModal({
      title: '取消预约',
      content: '确定要取消预约吗？取消后不可恢复。',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await cancelPrivateLesson(id)
            Taro.showToast({ title: '已取消预约', icon: 'success' })
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
        <Text className={styles.errorText}>无效的私教课</Text>
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

  if (!lesson) return null

  // --- Derived state ---

  const currentUserId = Taro.getStorageSync('userId') || null
  const isStudent = lesson.studentId === currentUserId
  const isOpenSlot = lesson.studentId === null
  const status = STATUS_MAP[lesson.status] || STATUS_MAP.scheduled
  const venues = resolvedVenues ?? []

  return (
    <View className={styles.container}>
      {/* Info card */}
      <View className={styles.card}>
        {/* Status + title */}
        <View className={styles.titleRow}>
          <Text className={styles.pageTitle}>私教详情</Text>
          <Text className={`${styles.statusTag} ${status.className}`}>
            {status.label}
          </Text>
        </View>

        {/* Coach info */}
        {coach && (
          <View
            className={styles.coachRow}
            onClick={() => navigateToCoach(lesson.coachId)}
          >
            {coach.avatarUrl ? (
              <Image
                className={styles.coachAvatarImg}
                src={coach.avatarUrl}
                mode='aspectFill'
              />
            ) : (
              <View className={styles.coachAvatarPlaceholder}>
                <Text>{coach.nickname.charAt(0)}</Text>
              </View>
            )}
            <View className={styles.coachInfo}>
              <Text className={styles.coachName}>{coach.nickname}</Text>
              <Text className={styles.coachLabel}>教练</Text>
            </View>
            <Text className={styles.coachArrow}>{'>'}</Text>
          </View>
        )}

        {/* Info rows */}
        <View className={styles.infoSection}>
          {/* Time */}
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>🕐</Text>
            <View className={styles.infoContent}>
              <Text className={styles.infoMain}>{formatDate(lesson.startTime)}</Text>
              <Text className={styles.infoSub}>
                {formatTime(lesson.startTime)} - {formatTime(lesson.endTime)}
              </Text>
            </View>
          </View>

          {/* Venue */}
          {lesson.venue && (
            <View className={styles.infoRow}>
              <Text className={styles.infoIcon}>📍</Text>
              <View className={styles.infoContent}>
                <Text className={styles.infoMain}>{lesson.venue.name}</Text>
                {lesson.venue.address && (
                  <Text className={styles.infoSub}>{lesson.venue.address}</Text>
                )}
              </View>
            </View>
          )}

          {/* Fee */}
          {lesson.feeDescription && (
            <View className={styles.infoRow}>
              <Text className={styles.infoIcon}>💰</Text>
              <View className={styles.infoContent}>
                <Text className={styles.infoMain}>{lesson.feeDescription}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Training content */}
      {lesson.trainingContent && (
        <View className={styles.sectionCard}>
          <Text className={styles.sectionTitle}>训练内容</Text>
          <Text className={styles.sectionContent}>{lesson.trainingContent}</Text>
        </View>
      )}

      {/* Student info (when booked) */}
      {student && (
        <View className={styles.sectionCard}>
          <Text className={styles.sectionTitle}>学员</Text>
          <View className={styles.studentRow}>
            {student.avatarUrl ? (
              <Image
                className={styles.studentAvatarImg}
                src={student.avatarUrl}
                mode='aspectFill'
              />
            ) : (
              <View className={styles.studentAvatarPlaceholder}>
                <Text>{student.nickname.charAt(0)}</Text>
              </View>
            )}
            <Text className={styles.studentName}>{student.nickname}</Text>
          </View>
        </View>
      )}

      {/* Venue picker for open slots */}
      {isOpenSlot && lesson.status === 'scheduled' && venues.length > 0 && (
        <View className={styles.venuePickerCard}>
          <Text className={styles.sectionTitle}>选择场馆</Text>
          {venues.map((venue) => (
            <View
              key={venue.id}
              className={`${styles.venueOption} ${selectedVenueId === venue.id ? styles.venueOptionSelected : ''}`}
              onClick={() => setSelectedVenueId(venue.id)}
            >
              <View
                className={`${styles.venueRadio} ${selectedVenueId === venue.id ? styles.venueRadioChecked : ''}`}
              />
              <Text className={styles.venueName}>{venue.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Status notices */}
      {lesson.status === 'in_progress' && (
        <View className={styles.noticeInProgress}>
          <Text>课程进行中</Text>
        </View>
      )}

      {lesson.status === 'cancelled' && (
        <View className={styles.noticeCancelled}>
          <Text>该私教课已取消</Text>
        </View>
      )}

      {lesson.status === 'expired' && (
        <View className={styles.noticeExpired}>
          <Text>该时段已过期</Text>
        </View>
      )}

      {/* Bottom action bar */}
      <View className={styles.bottomBar}>
        {/* Open slot + scheduled -> book */}
        {isOpenSlot && lesson.status === 'scheduled' && (
          <Button
            className={styles.btnBook}
            onClick={handleBook}
            disabled={booking}
          >
            {booking ? '预约中...' : '预约'}
          </Button>
        )}

        {/* Student view + scheduled -> cancel */}
        {isStudent && lesson.status === 'scheduled' && (
          <Button className={styles.btnCancel} onClick={handleCancel}>
            取消预约
          </Button>
        )}

        {/* Disabled states */}
        {lesson.status !== 'scheduled' && DISABLED_STATUS_TEXT[lesson.status] && (
          <Button className={styles.btnDisabled} disabled>
            {DISABLED_STATUS_TEXT[lesson.status]}
          </Button>
        )}
      </View>
    </View>
  )
}
