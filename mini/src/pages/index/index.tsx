import { useState, useEffect, useCallback } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { View, Text, Switch } from '@tarojs/components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLoginCheck } from '../../hooks/use-login-check'
import { useLocation } from '../../hooks/use-location'
import {
  getActivities,
  type ActivityListItem,
  type GetActivitiesParams,
} from '../../apis/activity'
import styles from './index.module.scss'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

const DATE_OPTIONS = [
  { value: 'today', label: '今天' },
  { value: 'tomorrow', label: '明天' },
  { value: 'this_week', label: '本周' },
] as const

const STATUS_MAP: Record<
  ActivityListItem['status'],
  { label: string; className: string }
> = {
  open: { label: '报名中', className: styles.statusOpen },
  full: { label: '已满', className: styles.statusFull },
  in_progress: { label: '进行中', className: styles.statusInProgress },
  completed: { label: '已结束', className: styles.statusCompleted },
  cancelled: { label: '已取消', className: styles.statusCancelled },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function formatDistance(meters?: number): string | null {
  if (meters === undefined) return null
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Index() {
  const isLoggedIn = useLoginCheck()
  const { location, getLocation } = useLocation()
  const queryClient = useQueryClient()

  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [hasSlots, setHasSlots] = useState(false)
  const [page, setPage] = useState(1)
  const [allItems, setAllItems] = useState<ActivityListItem[]>([])
  const [hasMore, setHasMore] = useState(true)

  // Try to get location on mount
  useEffect(() => {
    getLocation()
  }, [getLocation])

  // Build query params
  const queryParams: GetActivitiesParams = {
    page,
    pageSize: PAGE_SIZE,
    ...(dateFilter ? { dateFilter: dateFilter as GetActivitiesParams['dateFilter'] } : {}),
    ...(hasSlots ? { hasSlots: true } : {}),
    ...(location ? { latitude: location.latitude, longitude: location.longitude, sortBy: 'distance' as const } : {}),
  }

  const queryKey = ['activities', dateFilter, hasSlots, location?.latitude, location?.longitude, page]

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => getActivities(queryParams),
    enabled: isLoggedIn,
  })

  // Accumulate items across pages
  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllItems(data.items)
    } else {
      setAllItems((prev) => [...prev, ...data.items])
    }
    setHasMore(page * PAGE_SIZE < data.total)
  }, [data, page])

  // Reset to page 1 when filters change
  const resetList = useCallback(() => {
    setPage(1)
    setAllItems([])
    setHasMore(true)
  }, [])

  const handleDateFilter = (value: string) => {
    setDateFilter((prev) => (prev === value ? null : value))
    resetList()
  }

  const handleSlotsChange = (e: { detail: { value: boolean } }) => {
    setHasSlots(e.detail.value)
    resetList()
  }

  // Pull down to refresh
  usePullDownRefresh(() => {
    resetList()
    queryClient.invalidateQueries({ queryKey: ['activities'] })
    refetch().finally(() => {
      Taro.stopPullDownRefresh()
    })
  })

  // Reach bottom to load more
  useReachBottom(() => {
    if (hasMore && !isLoading) {
      setPage((prev) => prev + 1)
    }
  })

  const handleCardClick = (id: string) => {
    Taro.navigateTo({ url: `/pages/activity-detail/index?id=${id}` })
  }

  if (!isLoggedIn) return null

  return (
    <View>
      {/* Filter Bar */}
      <View className={styles.filterBar}>
        {DATE_OPTIONS.map((opt) => (
          <View
            key={opt.value}
            className={`${styles.chip} ${dateFilter === opt.value ? styles.chipActive : ''}`}
            onClick={() => handleDateFilter(opt.value)}
          >
            <Text>{opt.label}</Text>
          </View>
        ))}
        <View className={styles.slotFilter}>
          <Text className={styles.slotLabel}>有空位</Text>
          <Switch
            checked={hasSlots}
            color="#4ADE80"
            onChange={handleSlotsChange}
          />
        </View>
      </View>

      {/* Content */}
      <View className={styles.listContainer}>
        {/* Loading (first page) */}
        {isLoading && page === 1 && (
          <View className={styles.loading}>
            <Text className={styles.loadingText}>加载中...</Text>
          </View>
        )}

        {/* Error */}
        {isError && (
          <View className={styles.errorState}>
            <Text className={styles.errorText}>加载失败，请下拉刷新重试</Text>
          </View>
        )}

        {/* Empty */}
        {!isLoading && !isError && allItems.length === 0 && data && (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>🏸</Text>
            <Text className={styles.emptyText}>暂无约球活动</Text>
          </View>
        )}

        {/* Activity Cards */}
        {allItems.map((activity) => {
          const status = STATUS_MAP[activity.status] || STATUS_MAP.open
          const dist = formatDistance(activity.distance)

          return (
            <View
              key={activity.id}
              className={styles.card}
              onClick={() => handleCardClick(activity.id)}
            >
              {/* Header: venue name + status */}
              <View className={styles.cardHeader}>
                <Text className={styles.venueName}>
                  {activity.venue?.name || '未知场馆'}
                </Text>
                <Text className={`${styles.statusTag} ${status.className}`}>
                  {status.label}
                </Text>
              </View>

              {/* Body */}
              <View className={styles.cardBody}>
                {/* Time */}
                <View className={styles.infoRow}>
                  <Text className={styles.infoIcon}>🕐</Text>
                  <Text className={styles.infoText}>
                    {formatTime(activity.startTime)} - {formatTime(activity.endTime)}
                  </Text>
                </View>

                {/* Participants */}
                <View className={styles.infoRow}>
                  <Text className={styles.infoIcon}>👥</Text>
                  <Text className={styles.infoText}>
                    {activity.currentParticipants}/{activity.maxParticipants} 人
                  </Text>
                </View>

                {/* Address */}
                {activity.venue?.address && (
                  <View className={styles.infoRow}>
                    <Text className={styles.infoIcon}>📍</Text>
                    <Text className={styles.infoText}>{activity.venue.address}</Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              <View className={styles.cardFooter}>
                <View className={styles.creatorInfo}>
                  <Text className={styles.creatorName}>
                    {activity.creator.nickname}
                  </Text>
                </View>
                {dist && <Text className={styles.distance}>{dist}</Text>}
              </View>
            </View>
          )
        })}

        {/* Load more indicator */}
        {isLoading && page > 1 && (
          <View className={styles.loadMore}>
            <Text className={styles.loadMoreText}>加载更多...</Text>
          </View>
        )}

        {!hasMore && allItems.length > 0 && (
          <View className={styles.loadMore}>
            <Text className={styles.loadMoreText}>没有更多了</Text>
          </View>
        )}
      </View>
    </View>
  )
}
