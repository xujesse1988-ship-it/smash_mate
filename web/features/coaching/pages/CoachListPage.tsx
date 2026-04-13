import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachList } from '../hooks/useCoachList';
import { useCoachRatings } from '../hooks/useCoachRatings';
import { Chip } from '../../../shared/components/Chip';

const SPECIALTIES = [
  { value: null, label: '全部' },
  { value: 'singles', label: '单打' },
  { value: 'doubles', label: '双打' },
  { value: 'footwork', label: '步法' },
  { value: 'fitness', label: '体能' },
  { value: 'tactics', label: '战术' },
] as const;

const SPECIALTY_LABELS: Record<string, string> = {
  singles: '单打',
  doubles: '双打',
  footwork: '步法',
  fitness: '体能',
  tactics: '战术',
};

export function CoachListPage() {
  const navigate = useNavigate();
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useCoachList({ specialty: specialtyFilter });

  const allCoaches = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const { mergedCoaches, isRatingsLoading } = useCoachRatings(
    allCoaches,
    allCoaches.length > 0,
  );

  const showLoading = isLoading || (isRatingsLoading && allCoaches.length > 0 && mergedCoaches.length === 0);

  return (
    <div>
      {/* Specialty Filter */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          overflowX: 'auto',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        {SPECIALTIES.map((spec) => (
          <Chip
            key={spec.label}
            active={specialtyFilter === spec.value}
            onClick={() => setSpecialtyFilter(spec.value)}
          >
            {spec.label}
          </Chip>
        ))}
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        {/* Loading */}
        {showLoading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-2)' }}>加载中...</div>}

        {/* Error */}
        {error && <div style={{ textAlign: 'center', padding: 48, color: 'var(--danger)' }}>加载失败，请重试</div>}

        {/* Empty State */}
        {!isLoading && !error && mergedCoaches.length === 0 && data && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>暂无教练</div>
        )}

        {/* Coach Cards */}
        {mergedCoaches.map((coach) => (
          <div
            key={coach.userId}
            data-testid={`coach-card-${coach.userId}`}
            onClick={() => navigate(`/coaches/${coach.userId}`)}
            className="dark-card"
            style={{ marginBottom: 10, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {coach.avatarUrl ? (
                <img
                  src={coach.avatarUrl}
                  alt={coach.nickname}
                  className="avatar-grad-ring"
                  style={{ width: 52, height: 52, flexShrink: 0 }}
                />
              ) : (
                <div
                  className="avatar-grad-ring"
                  style={{
                    width: 52,
                    height: 52,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-1)',
                    background: 'var(--surface-2)',
                    flexShrink: 0,
                  }}
                >
                  {coach.nickname.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>
                  {coach.nickname}
                </div>
                {coach.bio && (
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6, lineHeight: 1.4 }}>
                    {coach.bio}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {coach.specialties.map((s) => (
                    <span
                      key={s}
                      className={s === 'singles' || s === 'doubles' || s === 'footwork' ? 'tag-green' : 'tag-blue'}
                    >
                      {SPECIALTY_LABELS[s] || s}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {coach.averageRating !== null ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warning)' }}>
                      {coach.averageRating} <span className="star">★</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>({coach.totalCount}条)</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-3)' }}>
                      暂无 <span style={{ color: 'var(--text-3)' }}>★</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>暂无评价</div>
                  </>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                  {coach.studentCount}名学员
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Load More */}
        {hasNextPage && (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="btn-dark btn-outline btn-sm"
            >
              {isFetchingNextPage ? '加载中...' : '加载更多'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
