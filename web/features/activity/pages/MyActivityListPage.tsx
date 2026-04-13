import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { BackButton } from '../../../shared/components/BackButton';
import { useMyActivities } from '../hooks/useMyActivities';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import { ActivityCard } from '../components/ActivityCard';
import { Chip } from '../../../shared/components/Chip';

// ---------------------------------------------------------------------------
// MyActivityListPage
// ---------------------------------------------------------------------------

export function MyActivityListPage() {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.userId);
  const [status, setStatus] = useState<string | null>(null);

  const activitiesQuery = useMyActivities({
    userId: currentUserId || '',
    status,
  });

  const allActivities = useMemo(
    () => activitiesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activitiesQuery.data],
  );

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: activitiesQuery.hasNextPage,
    isFetchingNextPage: activitiesQuery.isFetchingNextPage,
    fetchNextPage: activitiesQuery.fetchNextPage,
  });

  const statusOptions = [
    { value: null, label: '全部' },
    { value: 'open', label: '报名中' },
    { value: 'full', label: '已满员' },
    { value: 'in_progress', label: '进行中' },
    { value: 'completed', label: '已结束' },
    { value: 'cancelled', label: '已取消' },
  ];

  return (
    <div>
      {/* Header with back button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid var(--surface-2)',
          background: 'rgba(15,23,42,.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <BackButton onClick={() => navigate(-1)} style={{ marginRight: 8 }} />
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-1)' }}>我的活动</h2>
      </div>

      {/* Status filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          overflowX: 'auto',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        {statusOptions.map((opt) => (
          <Chip
            key={opt.value ?? 'all'}
            active={status === opt.value}
            onClick={() => setStatus(opt.value)}
          >
            {opt.label}
          </Chip>
        ))}
      </div>

      {/* Content area */}
      <div style={{ padding: '10px 14px 0' }}>
        {/* Loading state */}
        {activitiesQuery.isLoading && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-2)' }}>加载中...</div>
        )}

        {/* Error state */}
        {activitiesQuery.error && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--danger)' }}>加载失败，请重试</div>
        )}

        {/* Empty state */}
        {!activitiesQuery.isLoading &&
          !activitiesQuery.error &&
          activitiesQuery.data &&
          allActivities.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>暂无活动</div>
          )}

        {/* Activity list */}
        {allActivities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            variant="my"
            onClick={() => navigate(`/activities/${activity.id}`)}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {activitiesQuery.hasNextPage && (
          <div ref={sentinelRef} style={{ textAlign: 'center', padding: 16, color: 'var(--text-3)' }}>
            {activitiesQuery.isFetchingNextPage ? '加载更多...' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
