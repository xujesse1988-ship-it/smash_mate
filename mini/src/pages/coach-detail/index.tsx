import { useState, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import {
  getCoachProfile,
  getCoachRating,
  getCoachReviews,
  type CoachProfileGroupClass,
  type CoachProfileSlot,
  type ReviewItem,
} from '../../apis/coaching'
import { formatDateTime } from '../../utils/format'
import styles from './index.module.scss'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPECIALTY_LABELS: Record<string, string> = {
  singles: '单打',
  doubles: '双打',
  footwork: '步法',
  fitness: '体能',
  tactics: '战术',
}

const STATUS_LABELS: Record<string, string> = {
  open: '报名中',
  full: '已满员',
  in_progress: '进行中',
  completed: '已结束',
  cancelled: '已取消',
}

const STATUS_STYLES: Record<string, string> = {
  open: styles.gcStatusOpen,
  full: styles.gcStatusFull,
  in_progress: styles.gcStatusInProgress,
  completed: styles.gcStatusCompleted,
  cancelled: styles.gcStatusCancelled,
}

type TabKey = 'group' | 'private' | 'reviews'

const REVIEW_PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GroupClassList({
  classes,
}: {
  classes: CoachProfileGroupClass[]
}) {
  const handleClick = useCallback((gc: CoachProfileGroupClass) => {
    Taro.navigateTo({ url: `/pages/group-class-detail/index?id=${gc.id}` })
  }, [])

  if (classes.length === 0) {
    return <View className={styles.empty}>暂无团课</View>
  }

  return (
    <View>
      {classes.map((gc) => (
        <View
          key={gc.id}
          className={styles.groupClassCard}
          onClick={() => handleClick(gc)}
        >
          <View className={styles.gcHeader}>
            <Text className={styles.gcTitle}>{gc.title}</Text>
            <Text className={styles.gcBadge}>团课</Text>
          </View>
          <Text className={styles.gcTime}>
            {formatDateTime(gc.startTime)} - {formatDateTime(gc.endTime)}
          </Text>
          <Text className={styles.gcVenue}>
            {gc.venue?.name || '地点待定'}
          </Text>
          <View className={styles.gcFooter}>
            <Text className={styles.gcParticipants}>
              {gc.currentParticipants}/{gc.maxParticipants}人
            </Text>
            {gc.feeDescription && (
              <Text className={styles.gcFee}>{gc.feeDescription}</Text>
            )}
            <Text
              className={`${styles.gcStatus} ${STATUS_STYLES[gc.status] || styles.gcStatusCancelled}`}
            >
              {STATUS_LABELS[gc.status] || gc.status}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function PrivateLessonList({ slots }: { slots: CoachProfileSlot[] }) {
  if (slots.length === 0) {
    return <View className={styles.empty}>暂无可预约时段</View>
  }

  return (
    <View>
      {slots.map((slot) => (
        <View key={slot.id} className={styles.slotCard}>
          <Text className={styles.slotTime}>
            {formatDateTime(slot.startTime)} - {formatDateTime(slot.endTime)}
          </Text>
          {slot.venues.length > 0 && (
            <Text className={styles.slotVenues}>
              可选场馆: {slot.venues.map((v) => v.name).join('、')}
            </Text>
          )}
          {slot.feeDescription && (
            <Text className={styles.slotFee}>{slot.feeDescription}</Text>
          )}
          {slot.isBooked ? (
            <Text className={styles.slotBooked}>已预约</Text>
          ) : (
            <Text className={styles.slotAvailable}>可预约</Text>
          )}
        </View>
      ))}
    </View>
  )
}

function ReviewList({
  coachId,
}: {
  coachId: string
}) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['coachReviews', coachId, page],
    queryFn: () =>
      getCoachReviews(coachId, { page, pageSize: REVIEW_PAGE_SIZE }),
    enabled: !!coachId,
  })

  const reviews: ReviewItem[] = data?.items ?? []
  const total = data?.total ?? 0
  const hasMore = page * REVIEW_PAGE_SIZE < total

  if (isLoading && page === 1) {
    return <View className={styles.loading}>加载中...</View>
  }

  if (!isLoading && reviews.length === 0 && page === 1) {
    return <View className={styles.empty}>暂无评价</View>
  }

  return (
    <View>
      {reviews.map((review) => (
        <View key={review.id} className={styles.reviewCard}>
          <View className={styles.reviewHeader}>
            {review.reviewer.avatarUrl ? (
              <Image
                className={styles.reviewAvatar}
                src={review.reviewer.avatarUrl}
                mode="aspectFill"
              />
            ) : (
              <View className={styles.reviewAvatarPlaceholder}>
                {review.reviewer.nickname.charAt(0)}
              </View>
            )}
            <View className={styles.reviewInfo}>
              <Text className={styles.reviewerName}>
                {review.reviewer.nickname}
              </Text>
              <Text className={styles.reviewRating}>
                {'★'.repeat(review.rating)}
                {'☆'.repeat(5 - review.rating)}
              </Text>
            </View>
          </View>
          {review.comment && (
            <Text className={styles.reviewComment}>{review.comment}</Text>
          )}
          <Text className={styles.reviewDate}>
            {formatDateTime(review.createdAt)}
          </Text>
        </View>
      ))}

      {isLoading && page > 1 && (
        <View className={styles.loadingMore}>加载中...</View>
      )}

      {hasMore && !isLoading && (
        <View
          className={styles.loadingMore}
          onClick={() => setPage((p) => p + 1)}
        >
          加载更多
        </View>
      )}

      {!hasMore && reviews.length > 0 && (
        <View className={styles.noMore}>-- 没有更多了 --</View>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CoachDetailPage() {
  const { id } = Taro.getCurrentInstance().router?.params || {}
  const [activeTab, setActiveTab] = useState<TabKey>('group')

  const {
    data: coach,
    isLoading: isCoachLoading,
    error: coachError,
  } = useQuery({
    queryKey: ['coachProfile', id],
    queryFn: () => getCoachProfile(id!),
    enabled: !!id,
  })

  const { data: rating } = useQuery({
    queryKey: ['coachRating', id],
    queryFn: () => getCoachRating(id!),
    enabled: !!id,
  })

  // --- Render states ---

  if (!id) {
    return (
      <View className={styles.container}>
        <View className={styles.error}>无效的教练</View>
      </View>
    )
  }

  if (isCoachLoading) {
    return (
      <View className={styles.container}>
        <View className={styles.loading}>加载中...</View>
      </View>
    )
  }

  if (coachError) {
    return (
      <View className={styles.container}>
        <View className={styles.error}>加载失败，请返回重试</View>
      </View>
    )
  }

  if (!coach) return null

  return (
    <View className={styles.container}>
      {/* 教练头部信息 */}
      <View className={styles.header}>
        {coach.avatarUrl ? (
          <Image
            className={styles.avatar}
            src={coach.avatarUrl}
            mode="aspectFill"
          />
        ) : (
          <View className={styles.avatarPlaceholder}>
            {coach.nickname.charAt(0)}
          </View>
        )}
        <View className={styles.headerInfo}>
          <Text className={styles.nickname}>{coach.nickname}</Text>
          {coach.bio && <Text className={styles.bio}>{coach.bio}</Text>}
          <View className={styles.specialties}>
            {coach.specialties.map((s) => (
              <Text key={s} className={styles.specialtyTag}>
                {SPECIALTY_LABELS[s] || s}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* 评分区域 */}
      <View className={styles.ratingSection}>
        {rating && rating.averageRating !== null ? (
          <>
            <Text className={styles.ratingStars}>★</Text>
            <Text className={styles.ratingScore}>{rating.averageRating}</Text>
            <Text className={styles.reviewCount}>
              ({rating.totalCount}条评价)
            </Text>
          </>
        ) : (
          <Text className={styles.noRating}>暂无评价</Text>
        )}
      </View>

      {/* Tab 切换 */}
      <View className={styles.tabBar}>
        <View
          className={`${styles.tab} ${activeTab === 'group' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('group')}
        >
          <Text>团课</Text>
        </View>
        <View
          className={`${styles.tab} ${activeTab === 'private' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('private')}
        >
          <Text>私教</Text>
        </View>
        <View
          className={`${styles.tab} ${activeTab === 'reviews' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          <Text>评价</Text>
        </View>
      </View>

      {/* Tab 内容 */}
      <View className={styles.tabContent}>
        {activeTab === 'group' && (
          <GroupClassList classes={coach.groupClasses} />
        )}
        {activeTab === 'private' && (
          <PrivateLessonList slots={coach.privateLessonSlots} />
        )}
        {activeTab === 'reviews' && <ReviewList coachId={id} />}
      </View>
    </View>
  )
}
