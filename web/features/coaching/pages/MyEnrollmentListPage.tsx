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
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useMyEnrollments({
      type: typeFilter,
      status: apiStatus || undefined,
    });

  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    let items = data.pages.flatMap((page) => page.items);
    // Client-side filter for "upcoming"
    if (statusFilter === 'upcoming') {
      items = items.filter((item) => {
        const status =
          item.type === 'group-class' ? item.groupClass?.status : item.privateLesson?.status;
        return status === 'open' || status === 'full' || status === 'scheduled';
      });
    }
    return items;
  }, [data, statusFilter]);

  return (
    <div style={{ padding: 16, background: '#f5f5f5', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingBottom: 12,
            marginBottom: 16,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <button
            aria-label="返回"
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              marginRight: 8,
              padding: 0,
            }}
          >
            &lt; 返回
          </button>
          <h2 style={{ margin: 0, fontSize: 18 }}>我的课程</h2>
        </div>

        <section
          style={{
            padding: 18,
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: 18,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 12 }}>
            筛选课程
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setTypeFilter(f.value)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 999,
                  background: typeFilter === f.value ? '#111' : '#fff',
                  color: typeFilter === f.value ? '#fff' : '#333',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 999,
                  background: statusFilter === f.value ? '#111' : '#fff',
                  color: statusFilter === f.value ? '#fff' : '#333',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 18,
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: 18,
          }}
        >
          {isLoading && (
            <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>加载中...</div>
          )}

          {error && (
            <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>加载失败，请重试</div>
          )}

          {!isLoading && !error && allItems.length === 0 && data && (
            <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>暂无报名记录</div>
          )}

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
                  padding: '16px 14px',
                  border: '1px solid #ececec',
                  borderRadius: 14,
                  marginBottom: 10,
                  cursor: 'pointer',
                  background: '#fcfcfc',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div>
                    {isGroupClass && gc ? (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
                          {gc.title}
                        </div>
                        <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
                          {new Date(gc.startTime).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' - '}
                          {new Date(gc.endTime).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                          教练：{gc.coachNickname}
                        </div>
                        {gc.venue && (
                          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                            {gc.venue.name}
                          </div>
                        )}
                      </>
                    ) : pl ? (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>私教课</div>
                        <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
                          {new Date(pl.startTime).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' - '}
                          {new Date(pl.endTime).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                          教练：{pl.coachNickname}
                        </div>
                        {pl.venue && (
                          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                            {pl.venue.name}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                      background: (() => {
                        const status = isGroupClass ? gc?.status : pl?.status;
                        if (status === 'completed') return '#e8f1ff';
                        if (status === 'cancelled') return '#fff1f0';
                        return '#edf7ee';
                      })(),
                      color: (() => {
                        const status = isGroupClass ? gc?.status : pl?.status;
                        if (status === 'completed') return '#1565c0';
                        if (status === 'cancelled') return '#c62828';
                        return '#2e7d32';
                      })(),
                    }}
                  >
                    {STATUS_MAP[(isGroupClass ? gc?.status : pl?.status) || ''] ||
                      (isGroupClass ? gc?.status : pl?.status)}
                  </span>
                </div>
              </div>
            );
          })}

          {hasNextPage && (
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 999,
                  background: '#fff',
                  cursor: isFetchingNextPage ? 'not-allowed' : 'pointer',
                }}
              >
                {isFetchingNextPage ? '加载中...' : '加载更多'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
