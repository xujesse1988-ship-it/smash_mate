import { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useLoginCheck } from '../../hooks/use-login-check'
import { useAuthStore } from '../../stores/auth-store'
import { getMatchStats, type MatchStats } from '../../apis/user'
import {
  getUserMatchRecords,
  deleteMatchRecord,
  type MatchRecordItem,
  type MatchType,
} from '../../apis/match-record'
import { formatRelativeTime } from '../../utils/format'
import styles from './index.module.scss'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  singles: '单打',
  doubles: '双打',
}

const USER_RESULT_CONFIG: Record<string, { label: string; className: string }> = {
  WIN: { label: '胜', className: styles.resultTagWin },
  LOSE: { label: '负', className: styles.resultTagLose },
  DRAW: { label: '平', className: styles.resultTagDraw },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MatchRecordListPage() {
  const isLoggedIn = useLoginCheck()
  const userId = useAuthStore((s) => s.userId)

  const [stats, setStats] = useState<MatchStats | null>(null)
  const [records, setRecords] = useState<MatchRecordItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  const hasMore = records.length < total

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadStats = useCallback(async () => {
    if (!userId) return
    try {
      const result = await getMatchStats(userId)
      setStats(result)
    } catch {
      // silent
    }
  }, [userId])

  const loadFirstPage = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const result = await getUserMatchRecords(userId, { page: 1, pageSize: PAGE_SIZE })
      setRecords(result.items)
      setTotal(result.total)
      setPage(1)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [userId])

  const loadNextPage = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const result = await getUserMatchRecords(userId, { page: nextPage, pageSize: PAGE_SIZE })
      setRecords((prev) => [...prev, ...result.items])
      setTotal(result.total)
      setPage(nextPage)
    } catch {
      // silent
    } finally {
      setLoadingMore(false)
    }
  }, [userId, loadingMore, hasMore, page])

  // Load on first render (useDidShow equivalent via initialized flag)
  Taro.useDidShow(() => {
    if (isLoggedIn && userId) {
      loadStats()
      loadFirstPage()
    }
  })

  // -------------------------------------------------------------------------
  // Pull-down refresh / reach bottom
  // -------------------------------------------------------------------------

  usePullDownRefresh(async () => {
    await Promise.all([loadStats(), loadFirstPage()])
    Taro.stopPullDownRefresh()
  })

  useReachBottom(() => {
    if (hasMore && !loadingMore) {
      loadNextPage()
    }
  })

  // -------------------------------------------------------------------------
  // Expand / collapse
  // -------------------------------------------------------------------------

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  const handleDelete = useCallback(
    async (record: MatchRecordItem) => {
      const { confirm } = await Taro.showModal({
        title: '确认删除',
        content: '确定要删除这条战绩记录吗？',
        confirmColor: '#dc2626',
      })
      if (!confirm) return

      try {
        await deleteMatchRecord(record.id)
        setRecords((prev) => prev.filter((r) => r.id !== record.id))
        setTotal((prev) => prev - 1)
        // Refresh stats after deletion
        loadStats()
        Taro.showToast({ title: '已删除', icon: 'success' })
      } catch {
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    },
    [loadStats],
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!isLoggedIn) return null

  return (
    <View className={styles.container}>
      {/* Stats card */}
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

      {/* Loading state */}
      {loading && !initialized && (
        <View className={styles.loading}>
          <Text>加载中...</Text>
        </View>
      )}

      {/* Empty state */}
      {!loading && initialized && records.length === 0 && (
        <View className={styles.empty}>
          <Text className={styles.emptyText}>暂无战绩记录</Text>
          <Text className={styles.emptyText}>参加活动后录入战绩即可在此查看</Text>
        </View>
      )}

      {/* Record list */}
      {records.length > 0 && (
        <View className={styles.list}>
          {records.map((record) => {
            const isExpanded = expandedIds.has(record.id)
            const canDelete = record.recordedBy === userId
            const resultConfig = USER_RESULT_CONFIG[record.userResult ?? '']
            const sideANames = record.players.sideA.map((p) => p.nickname).join(' & ')
            const sideBNames = record.players.sideB.map((p) => p.nickname).join(' & ')
            const scoreSummary = record.games
              .map((g) => `${g.scoreA}:${g.scoreB}`)
              .join('  ')

            return (
              <View key={record.id} className={styles.recordCard}>
                <View className={styles.recordMain} onClick={() => toggleExpand(record.id)}>
                  {/* Header: tags + time */}
                  <View className={styles.recordHeader}>
                    <View className={styles.recordTags}>
                      <Text className={styles.matchTypeTag}>
                        {MATCH_TYPE_LABELS[record.matchType] ?? record.matchType}
                      </Text>
                      {resultConfig && (
                        <Text className={resultConfig.className}>{resultConfig.label}</Text>
                      )}
                    </View>
                    <Text className={styles.recordTime}>
                      {formatRelativeTime(record.createdAt)}
                    </Text>
                  </View>

                  {/* Players */}
                  <View className={styles.recordPlayers}>
                    <Text>{sideANames}</Text>
                    <Text className={styles.vsText}>vs</Text>
                    <Text>{sideBNames}</Text>
                  </View>

                  {/* Score summary */}
                  <Text className={styles.recordScore}>{scoreSummary}</Text>
                </View>

                {/* Expand button */}
                <View className={styles.expandBtn} onClick={() => toggleExpand(record.id)}>
                  <Text className={styles.expandBtnText}>
                    {isExpanded ? '收起详情' : '查看详情'}
                  </Text>
                </View>

                {/* Expanded game details */}
                {isExpanded && (
                  <View className={styles.gameDetails}>
                    {record.games.map((game) => (
                      <View key={game.gameNumber} className={styles.gameRow}>
                        <Text className={styles.gameLabel}>第{game.gameNumber}局</Text>
                        <Text className={styles.gameScore}>
                          {game.scoreA} : {game.scoreB}
                        </Text>
                      </View>
                    ))}
                    {canDelete && (
                      <View
                        className={styles.deleteBtn}
                        style={{
                          width: '100%',
                          marginTop: '16px',
                          borderRadius: '12px',
                          padding: '16px 0',
                        }}
                        onClick={() => handleDelete(record)}
                      >
                        <Text>删除记录</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          })}

          {/* Load more */}
          {loadingMore && (
            <View className={styles.loadMore}>
              <Text>加载中...</Text>
            </View>
          )}
          {!hasMore && records.length > 0 && (
            <View className={styles.loadMore}>
              <Text>没有更多了</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
