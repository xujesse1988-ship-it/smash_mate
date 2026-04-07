import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachList } from '../hooks/useCoachList';
import { useCoachRatings } from '../hooks/useCoachRatings';

const SPECIALTIES = [
  { value: null, label: '全部' },
  { value: 'singles', label: '单打' },
  { value: 'doubles', label: '双打' },
  { value: 'footwork', label: '步法' },
  { value: 'fitness', label: '体能' },
  { value: 'tactics', label: '战术' },
] as const;

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
    <div style={{ padding: '16px' }}>
      {/* Specialty Filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {SPECIALTIES.map((spec) => (
          <button
            key={spec.label}
            onClick={() => setSpecialtyFilter(spec.value)}
            style={{
              padding: '4px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '16px',
              background: specialtyFilter === spec.value ? '#00C853' : 'white',
              color: specialtyFilter === spec.value ? 'white' : '#333',
              cursor: 'pointer',
            }}
          >
            {spec.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {showLoading && <div>加载中...</div>}

      {/* Error */}
      {error && <div>加载失败，请重试</div>}

      {/* Empty State */}
      {!isLoading && !error && mergedCoaches.length === 0 && data && (
        <div>暂无教练</div>
      )}

      {/* Coach Cards */}
      {mergedCoaches.map((coach) => (
        <div
          key={coach.userId}
          data-testid={`coach-card-${coach.userId}`}
          onClick={() => navigate(`/coaches/${coach.userId}`)}
          style={{
            padding: '12px',
            border: '1px solid #f0f0f0',
            borderRadius: '8px',
            marginBottom: '12px',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {coach.avatarUrl ? (
              <img
                src={coach.avatarUrl}
                alt={coach.nickname}
                style={{ width: 48, height: 48, borderRadius: '50%' }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {coach.nickname.charAt(0)}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{coach.nickname}</div>
              {coach.bio && (
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{coach.bio}</div>
              )}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: 4 }}>
                {coach.specialties.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: '#e8f5e9',
                      color: '#2e7d32',
                    }}
                  >
                    {s === 'singles' ? '单打' : s === 'doubles' ? '双打' : s === 'footwork' ? '步法' : s === 'fitness' ? '体能' : s === 'tactics' ? '战术' : s}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {coach.averageRating !== null ? (
                <div style={{ fontWeight: 600, color: '#ff9800' }}>
                  {coach.averageRating} <span style={{ fontSize: 11, color: '#999' }}>({coach.totalCount})</span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#999' }}>暂无评价</div>
              )}
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {coach.studentCount} 名学员
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Load More */}
      {hasNextPage && (
        <div style={{ textAlign: 'center', padding: '12px' }}>
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
}
