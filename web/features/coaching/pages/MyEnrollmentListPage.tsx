import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyEnrollments } from '../hooks/useMyEnrollments';

const TYPE_FILTERS = [
  { value: null, label: '全部' },
  { value: 'group-class', label: '团课' },
  { value: 'private-lesson', label: '私教' },
] as const;

const STATUS_FILTERS = [
  { value: null, label: '不限' },
  { value: 'upcoming', label: '待开课' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已结束' },
  { value: 'cancelled', label: '已取消' },
] as const;

const STATUS_MAP: Record<string, string> = {
  open: '待开课',
  full: '待开课',
  scheduled: '待开课',
  in_progress: '进行中',
  completed: '已结束',
  cancelled: '已取消',
};

export function MyEnrollmentListPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // For "upcoming" (待开课), don't pass status to API, filter client-side
  const apiStatus = statusFilter && statusFilter !== 'upcoming' ? statusFilter : undefined;
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMyEnrollments({
    type: typeFilter,
    status: apiStatus || undefined,
  });

  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    let items = data.pages.flatMap((page) => page.items);
    // Client-side filter for "upcoming"
    if (statusFilter === 'upcoming') {
      items = items.filter((item) => {
        const status = item.type === 'group-class'
          ? item.groupClass?.status
          : item.privateLesson?.status;
        return status === 'open' || status === 'full' || status === 'scheduled';
      });
    }
    return items;
  }, [data, statusFilter]);

  return (
    <div style={{ padding: '16px' }}>
      {/* Type Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setTypeFilter(f.value)}
            style={{
              padding: '4px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '16px',
              background: typeFilter === f.value ? '#00C853' : 'white',
              color: typeFilter === f.value ? 'white' : '#333',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            style={{
              padding: '4px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '16px',
              background: statusFilter === f.value ? '#00C853' : 'white',
              color: statusFilter === f.value ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && <div>加载中...</div>}

      {/* Error */}
      {error && <div>加载失败，请重试</div>}

      {/* Empty State */}
      {!isLoading && !error && allItems.length === 0 && data && (
        <div style={{ color: '#999', textAlign: 'center', padding: '24px' }}>暂无报名记录</div>
      )}

      {/* Enrollment Cards */}
      {allItems.map((item) => {
        const isGroupClass = item.type === 'group-class';
        const gc = item.groupClass;
        const pl = item.privateLesson;

        return (
          <div
            key={isGroupClass ? gc?.id : pl?.id}
            data-testid={`enrollment-card-${isGroupClass ? gc?.id : pl?.id}`}
            onClick={() => {
              if (isGroupClass && gc) {
                navigate(`/group-classes/${gc.id}`);
              } else if (pl) {
                navigate(`/coaches/${pl.coachId}`);
              }
            }}
            style={{
              padding: '12px',
              border: '1px solid #f0f0f0',
              borderRadius: '8px',
              marginBottom: '8px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {isGroupClass && gc ? (
                  <>
                    <div style={{ fontWeight: 600 }}>{gc.title}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      {new Date(gc.startTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(gc.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>教练：{gc.coachNickname}</div>
                    {gc.venue && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{gc.venue.name}</div>}
                  </>
                ) : pl ? (
                  <>
                    <div style={{ fontWeight: 600 }}>私教课</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      {new Date(pl.startTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(pl.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>教练：{pl.coachNickname}</div>
                    {pl.venue && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{pl.venue.name}</div>}
                  </>
                ) : null}
              </div>
              <span style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: '4px',
                background: (() => {
                  const status = isGroupClass ? gc?.status : pl?.status;
                  if (status === 'completed') return '#e3f2fd';
                  if (status === 'cancelled') return '#ffebee';
                  return '#e8f5e9';
                })(),
                color: (() => {
                  const status = isGroupClass ? gc?.status : pl?.status;
                  if (status === 'completed') return '#1565c0';
                  if (status === 'cancelled') return '#c62828';
                  return '#2e7d32';
                })(),
              }}>
                {STATUS_MAP[(isGroupClass ? gc?.status : pl?.status) || ''] || (isGroupClass ? gc?.status : pl?.status)}
              </span>
            </div>
          </div>
        );
      })}

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
