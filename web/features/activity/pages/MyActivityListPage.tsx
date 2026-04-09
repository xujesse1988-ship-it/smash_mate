import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { BackButton } from '../../../shared/components/BackButton';
import { useMyActivities } from '../hooks/useMyActivities';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import { ActivityCard } from '../components/ActivityCard';
import { STATUS_LABELS } from '../constants';

// ---------------------------------------------------------------------------
// MyActivityListPage
// ---------------------------------------------------------------------------

export function MyActivityListPage() {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.userId);
  const [status, setStatus] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

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
    { value: null, label: '全部状态' },
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
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <BackButton onClick={() => navigate(-1)} style={{ marginRight: 8 }} />
        <h2 style={{ margin: 0, fontSize: 18 }}>我的活动</h2>
      </div>

      {/* Status filter */}
      <div style={{ padding: '8px 16px', position: 'relative' }}>
        <button
          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
          style={{
            fontSize: 13,
            padding: '2px 8px',
            border: '1px solid #ddd',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          状态{status ? `: ${STATUS_LABELS[status]}` : ''}
        </button>
        {showStatusDropdown && (
          <div
            style={{
              position: 'absolute',
              top: 36,
              left: 16,
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 8,
              padding: 8,
              zIndex: 10,
            }}
          >
            {statusOptions.map((opt) => (
              <div
                key={opt.value ?? 'all'}
                onClick={() => {
                  setStatus(opt.value);
                  setShowStatusDropdown(false);
                }}
                style={{ padding: '4px 16px', cursor: 'pointer' }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {activitiesQuery.isLoading && (
        <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>
      )}

      {/* Error state */}
      {activitiesQuery.error && (
        <div style={{ textAlign: 'center', padding: 48, color: 'red' }}>加载失败，请重试</div>
      )}

      {/* Empty state */}
      {!activitiesQuery.isLoading &&
        !activitiesQuery.error &&
        activitiesQuery.data &&
        allActivities.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>暂无活动</div>
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
        <div ref={sentinelRef} style={{ textAlign: 'center', padding: 16 }}>
          {activitiesQuery.isFetchingNextPage ? '加载更多...' : ''}
        </div>
      )}
    </div>
  );
}
