import { useState, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useLoginCheck } from '../../hooks/use-login-check'
import { getCoaches } from '../../apis/coaching'
import type { Specialty, CoachListItem } from '../../apis/coaching'
import styles from './index.module.scss'

const SPECIALTIES: Array<{ value: Specialty | null; label: string }> = [
  { value: null, label: '全部' },
  { value: 'singles', label: '单打' },
  { value: 'doubles', label: '双打' },
  { value: 'footwork', label: '步法' },
  { value: 'fitness', label: '体能' },
  { value: 'tactics', label: '战术' },
]

const SPECIALTY_LABELS: Record<Specialty, string> = {
  singles: '单打',
  doubles: '双打',
  footwork: '步法',
  fitness: '体能',
  tactics: '战术',
}

const PAGE_SIZE = 10

export default function CoachListPage() {
  const isLoggedIn = useLoginCheck()

  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['coaches', specialty, page],
    queryFn: () =>
      getCoaches({
        page,
        pageSize: PAGE_SIZE,
        specialty: specialty ?? undefined,
      }),
    enabled: isLoggedIn,
  })

  const coaches = data?.items ?? []
  const total = data?.total ?? 0
  const hasMore = page * PAGE_SIZE < total

  const handleFilterChange = useCallback((value: Specialty | null) => {
    setSpecialty(value)
    setPage(1)
  }, [])

  const handleCardClick = useCallback((coach: CoachListItem) => {
    Taro.navigateTo({ url: `/pages/coach-detail/index?id=${coach.id}` })
  }, [])

  usePullDownRefresh(() => {
    setPage(1)
    refetch().finally(() => {
      Taro.stopPullDownRefresh()
    })
  })

  useReachBottom(() => {
    if (hasMore && !isLoading) {
      setPage((prev) => prev + 1)
    }
  })

  return (
    <View className={styles.container}>
      {/* 筛选栏 */}
      <View className={styles.filterBar}>
        {SPECIALTIES.map((spec) => (
          <Text
            key={spec.label}
            className={`${styles.filterTag} ${specialty === spec.value ? styles.filterTagActive : ''}`}
            onClick={() => handleFilterChange(spec.value)}
          >
            {spec.label}
          </Text>
        ))}
      </View>

      {/* 列表区域 */}
      <View className={styles.list}>
        {/* 加载中 */}
        {isLoading && page === 1 && (
          <View className={styles.loading}>加载中...</View>
        )}

        {/* 错误 */}
        {error && (
          <View className={styles.error}>加载失败，请下拉刷新重试</View>
        )}

        {/* 空状态 */}
        {!isLoading && !error && coaches.length === 0 && (
          <View className={styles.empty}>暂无教练</View>
        )}

        {/* 教练卡片 */}
        {coaches.map((coach) => (
          <View
            key={coach.id}
            className={styles.card}
            onClick={() => handleCardClick(coach)}
          >
            <View className={styles.cardInner}>
              {/* 头像 */}
              {coach.avatarUrl ? (
                <Image
                  className={styles.avatar}
                  src={coach.avatarUrl}
                  mode='aspectFill'
                />
              ) : (
                <View className={styles.avatarPlaceholder}>
                  {coach.nickname.charAt(0)}
                </View>
              )}

              {/* 信息 */}
              <View className={styles.info}>
                <Text className={styles.nickname}>{coach.nickname}</Text>
                {coach.bio && (
                  <Text className={styles.bio}>{coach.bio}</Text>
                )}
                <View className={styles.specialties}>
                  {coach.specialties.map((s) => (
                    <Text key={s} className={styles.specialtyTag}>
                      {SPECIALTY_LABELS[s] || s}
                    </Text>
                  ))}
                </View>
              </View>

              {/* 评分 */}
              <View className={styles.ratingArea}>
                {coach.averageRating !== null ? (
                  <>
                    <Text className={styles.ratingScore}>
                      {coach.averageRating} <Text className={styles.ratingStar}>★</Text>
                    </Text>
                    <Text className={styles.reviewCount}>
                      ({coach.reviewCount}条评价)
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className={styles.noRating}>暂无 ★</Text>
                    <Text className={styles.noReview}>暂无评价</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        ))}

        {/* 加载更多 */}
        {isLoading && page > 1 && (
          <View className={styles.loadingMore}>加载中...</View>
        )}

        {/* 没有更多 */}
        {!hasMore && coaches.length > 0 && (
          <View className={styles.noMore}>— 没有更多了 —</View>
        )}
      </View>
    </View>
  )
}
