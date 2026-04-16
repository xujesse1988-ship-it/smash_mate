import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../../../shared/components/BackButton';
import { useMyEnrollments } from '../hooks/useMyEnrollments';

const TYPE_FILTERS = [
  { value: null, label: '全部' },
  { value: 'group-class', label: '团课' },
  { value: 'private-lesson', label: '私教' },
  { value: 'class-lesson', label: '学员班' },
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
          item.type === 'group-class'
            ? item.groupClass?.status
            : item.type === 'private-lesson'
              ? item.privateLesson?.status
              : item.classLesson?.status;
        return status === 'open' || status === 'full' || status === 'scheduled';
      });
    }
    return items;
  }, [data, statusFilter]);

  return (
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingBottom: 12,
            marginBottom: 16,
            borderBottom: '1px solid var(--surface-2)',
          }}
        >
          <BackButton onClick={() => navigate(-1)} style={{ marginRight: 8 }} />
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-1)' }}>我的课程</h2>
        </div>

        <section
          style={{
            padding: 18,
            background: 'var(--surface)',
            border: '1px solid var(--surface-2)',
            borderRadius: 18,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 12 }}>
            筛选课程
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setTypeFilter(f.value)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 999,
                  background: typeFilter === f.value ? 'var(--text-1)' : 'var(--surface)',
                  color: typeFilter === f.value ? 'var(--bg)' : 'var(--text-1)',
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
                  border: '1px solid var(--surface-2)',
                  borderRadius: 999,
                  background: statusFilter === f.value ? 'var(--text-1)' : 'var(--surface)',
                  color: statusFilter === f.value ? 'var(--bg)' : 'var(--text-1)',
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
            background: 'var(--surface)',
            border: '1px solid var(--surface-2)',
            borderRadius: 18,
          }}
        >
          {isLoading && (
            <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 24 }}>
              加载中...
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
              加载失败，请重试
            </div>
          )}

          {!isLoading && !error && allItems.length === 0 && data && (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
              暂无报名记录
            </div>
          )}

          {allItems.map((item) => {
            const gc = item.groupClass;
            const pl = item.privateLesson;
            const cl = item.classLesson;

            const cardKey =
              item.type === 'group-class'
                ? gc?.id
                : item.type === 'private-lesson'
                  ? pl?.id
                  : cl?.id;

            const status =
              item.type === 'group-class'
                ? gc?.status
                : item.type === 'private-lesson'
                  ? pl?.status
                  : cl?.status;

            const handleClick = () => {
              if (item.type === 'group-class' && gc) {
                navigate(`/group-classes/${gc.id}`);
              } else if (item.type === 'private-lesson' && pl) {
                navigate(`/private-lessons/${pl.id}`);
              } else if (item.type === 'class-lesson' && cl) {
                navigate(`/my-student-classes/${cl.studentClassId}/lessons/${cl.id}`);
              }
            };

            return (
              <div
                key={`${item.type}-${cardKey}`}
                data-testid={`enrollment-card-${cardKey}`}
                onClick={handleClick}
                style={{
                  padding: '16px 14px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 14,
                  marginBottom: 10,
                  cursor: 'pointer',
                  background: 'var(--surface-2)',
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
                    {item.type === 'group-class' && gc ? (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
                          {gc.title}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
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
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                          教练：{gc.coachNickname}
                        </div>
                        {gc.venue && (
                          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                            {gc.venue.name}
                          </div>
                        )}
                      </>
                    ) : item.type === 'private-lesson' && pl ? (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
                          私教课
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
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
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                          教练：{pl.coachNickname}
                        </div>
                        {pl.venue && (
                          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                            {pl.venue.name}
                          </div>
                        )}
                      </>
                    ) : item.type === 'class-lesson' && cl ? (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
                          {cl.studentClassName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                          学员班排课
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
                          {new Date(cl.startTime).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' - '}
                          {new Date(cl.endTime).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                          教练：{cl.coachNickname}
                        </div>
                        {cl.venue && (
                          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                            {cl.venue.name}
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
                        if (status === 'completed') return 'rgba(96,165,250,0.15)';
                        if (status === 'cancelled') return 'rgba(248,113,113,0.15)';
                        return 'var(--primary-dim)';
                      })(),
                      color: (() => {
                        if (status === 'completed') return 'var(--blue)';
                        if (status === 'cancelled') return 'var(--danger)';
                        return 'var(--primary)';
                      })(),
                    }}
                  >
                    {STATUS_MAP[status || ''] || status}
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
                  border: '1px solid var(--surface-2)',
                  borderRadius: 999,
                  background: 'var(--surface)',
                  color: 'var(--text-1)',
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
