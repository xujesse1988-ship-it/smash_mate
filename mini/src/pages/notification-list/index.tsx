import { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useLoginCheck } from '../../hooks/use-login-check'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type NotificationItem,
  type TargetType,
} from '../../apis/notification'
import { formatRelativeTime } from '../../utils/format'
import styles from './index.module.scss'

type FilterStatus = 'all' | 'unread' | 'read'

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'read', label: '已读' },
]

const PAGE_SIZE = 20

/** 跳转到通知对应的目标页 */
function navigateToTarget(targetType: TargetType, targetId: string) {
  const routeMap: Record<TargetType, string> = {
    activity: '/pages/activity-detail/index',
    'group-class': '/pages/group-class-detail/index',
    'private-lesson': '/pages/private-lesson-detail/index',
    'coach-profile': '/pages/coach-detail/index',
  }
  const path = routeMap[targetType]
  if (path) {
    Taro.navigateTo({ url: `${path}?id=${targetId}` })
  }
}

/** 更新 TabBar 未读角标 */
async function updateTabBarBadge() {
  try {
    const { count } = await getUnreadCount()
    if (count > 0) {
      Taro.setTabBarBadge({ index: 1, text: count > 99 ? '99+' : String(count) })
    } else {
      Taro.removeTabBarBadge({ index: 1 })
    }
  } catch {
    // 静默失败
  }
}

export default function NotificationList() {
  const isLoggedIn = useLoginCheck()

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const hasMore = notifications.length < total

  /** 加载第一页 */
  const loadFirstPage = useCallback(
    async (filter: FilterStatus) => {
      if (!isLoggedIn) return
      setLoading(true)
      try {
        const isReadParam = filter === 'all' ? undefined : filter === 'read'
        const result = await getNotifications({
          page: 1,
          pageSize: PAGE_SIZE,
          isRead: isReadParam,
        })
        setNotifications(result.items)
        setTotal(result.total)
        setPage(1)
      } catch {
        // 静默失败
      } finally {
        setLoading(false)
      }
    },
    [isLoggedIn],
  )

  /** 加载下一页 */
  const loadNextPage = useCallback(async () => {
    if (!isLoggedIn || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const isReadParam = filterStatus === 'all' ? undefined : filterStatus === 'read'
      const result = await getNotifications({
        page: nextPage,
        pageSize: PAGE_SIZE,
        isRead: isReadParam,
      })
      setNotifications((prev) => [...prev, ...result.items])
      setTotal(result.total)
      setPage(nextPage)
    } catch {
      // 静默失败
    } finally {
      setLoadingMore(false)
    }
  }, [isLoggedIn, loadingMore, hasMore, page, filterStatus])

  /** 页面显示时刷新 */
  useDidShow(() => {
    if (isLoggedIn) {
      loadFirstPage(filterStatus)
      updateTabBarBadge()
    }
  })

  /** 下拉刷新 */
  usePullDownRefresh(async () => {
    await loadFirstPage(filterStatus)
    await updateTabBarBadge()
    Taro.stopPullDownRefresh()
  })

  /** 上拉加载更多 */
  useReachBottom(() => {
    if (hasMore && !loadingMore) {
      loadNextPage()
    }
  })

  /** 切换筛选 */
  const handleFilterChange = useCallback(
    (filter: FilterStatus) => {
      if (filter === filterStatus) return
      setFilterStatus(filter)
      setNotifications([])
      loadFirstPage(filter)
    },
    [filterStatus, loadFirstPage],
  )

  /** 点击通知 */
  const handleClickNotification = useCallback(
    async (item: NotificationItem) => {
      if (!item.isRead) {
        try {
          await markAsRead(item.id)
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
          )
          updateTabBarBadge()
        } catch {
          // 静默失败
        }
      }
      navigateToTarget(item.targetType, item.targetId)
    },
    [],
  )

  /** 全部已读 */
  const handleMarkAllAsRead = useCallback(async () => {
    if (markingAll) return
    setMarkingAll(true)
    try {
      await markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      updateTabBarBadge()
    } catch {
      // 静默失败
    } finally {
      setMarkingAll(false)
    }
  }, [markingAll])

  if (!isLoggedIn) return null

  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <View className={styles.container}>
      {/* 筛选栏 */}
      <View className={styles.filterBar}>
        <View className={styles.tabs}>
          {FILTER_TABS.map((tab) => (
            <Text
              key={tab.key}
              className={`${styles.tab} ${filterStatus === tab.key ? styles.tabActive : ''}`}
              onClick={() => handleFilterChange(tab.key)}
            >
              {tab.label}
            </Text>
          ))}
        </View>
        {hasUnread && (
          <Text
            className={`${styles.markAllBtn} ${markingAll ? styles.markAllBtnDisabled : ''}`}
            onClick={handleMarkAllAsRead}
          >
            全部已读
          </Text>
        )}
      </View>

      {/* 加载中 */}
      {loading && (
        <View className={styles.loading}>
          <Text>加载中...</Text>
        </View>
      )}

      {/* 空状态 */}
      {!loading && notifications.length === 0 && (
        <View className={styles.empty}>
          <Text className={styles.emptyText}>暂无通知</Text>
        </View>
      )}

      {/* 通知列表 */}
      {!loading && notifications.length > 0 && (
        <View className={styles.list}>
          {notifications.map((item) => (
            <View
              key={item.id}
              className={styles.notificationItem}
              onClick={() => handleClickNotification(item)}
            >
              <View className={item.isRead ? styles.readDot : styles.unreadDot} />
              <View className={styles.notificationContent}>
                <Text
                  className={`${styles.notificationTitle} ${item.isRead ? styles.notificationTitleRead : ''}`}
                >
                  {item.title}
                </Text>
                <Text className={styles.notificationBody}>{item.content}</Text>
                <Text className={styles.notificationTime}>
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
            </View>
          ))}
          {loadingMore && (
            <View className={styles.loadMore}>
              <Text>加载中...</Text>
            </View>
          )}
          {!hasMore && notifications.length > 0 && (
            <View className={styles.loadMore}>
              <Text>没有更多了</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
