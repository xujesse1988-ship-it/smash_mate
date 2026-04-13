import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useGroupClassDetail } from '../hooks/useGroupClassDetail';
import { useEnrollGroupClass } from '../hooks/useEnrollGroupClass';
import { useCancelEnrollment } from '../hooks/useCancelEnrollment';
import { useGroupClassMatchRecords } from '../hooks/useGroupClassMatchRecords';
import { useDeleteMatchRecord } from '../hooks/useDeleteMatchRecord';
import { BackButton } from '../../../shared/components/BackButton';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[d.getDay()];
  return `${month}月${day}日 周${weekday}`;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'open':
      return { bg: 'var(--primary-dim)', color: 'var(--primary)', border: 'rgba(74,222,128,0.25)', label: '报名中' };
    case 'full':
      return { bg: 'rgba(251,191,36,0.15)', color: 'var(--warning)', border: 'rgba(251,191,36,0.25)', label: '已满员' };
    case 'in_progress':
      return { bg: 'rgba(96,165,250,0.15)', color: 'var(--blue)', border: 'rgba(96,165,250,0.25)', label: '进行中' };
    case 'completed':
      return { bg: 'rgba(168,85,247,0.15)', color: '#a855f7', border: 'rgba(168,85,247,0.25)', label: '已结束' };
    case 'cancelled':
      return { bg: 'rgba(248,113,113,0.15)', color: 'var(--danger)', border: 'rgba(248,113,113,0.25)', label: '已取消' };
    default:
      return { bg: 'var(--surface-2)', color: 'var(--text-3)', border: 'var(--surface-3)', label: status };
  }
}

// ---------------------------------------------------------------------------
// GroupClassDetailPage
// ---------------------------------------------------------------------------

export function GroupClassDetailPage() {
  const { id: groupClassId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.userId);

  const { data: groupClass, isLoading, error } = useGroupClassDetail(groupClassId || '');
  const enrollMutation = useEnrollGroupClass();
  const cancelEnrollMutation = useCancelEnrollment();
  const { data: matchRecordsData } = useGroupClassMatchRecords(groupClassId || '', {
    enabled: groupClass?.status === 'completed',
  });
  const deleteRecordMutation = useDeleteMatchRecord(groupClassId || '');

  const [showCancelEnrollConfirm, setShowCancelEnrollConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 48 }}>加载失败：团课不存在</div>;
  if (!groupClass) return null;

  const isCoach = currentUserId === groupClass.coachId;
  const isEnrolled = groupClass.enrollments.some((e) => e.userId === currentUserId);
  const statusStyle = getStatusStyle(groupClass.status);

  const handleEnroll = () => {
    enrollMutation.mutate(groupClassId!);
  };

  const handleCancelEnrollment = () => {
    cancelEnrollMutation.mutate(groupClassId!);
    setShowCancelEnrollConfirm(false);
  };

  const handleDeleteRecord = () => {
    if (deletingRecordId) {
      deleteRecordMutation.mutate(deletingRecordId);
      setShowDeleteConfirm(false);
      setDeletingRecordId(null);
    }
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'rgba(15,23,42,.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        <BackButton onClick={() => navigate(-1)} style={{ padding: '4px 0', marginRight: 12 }} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>团课详情</h2>
      </div>

      {/* Main content */}
      <div style={{ padding: '12px 16px' }}>
        {/* Course info card */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          {/* Status + Title */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  border: `1px solid ${statusStyle.border}`,
                }}
              >
                {statusStyle.label}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>
              {groupClass.title}
            </h2>
          </div>

          {/* Coach info */}
          <div
            onClick={() => navigate(`/coaches/${groupClass.coachId}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 18,
              padding: '10px 12px',
              background: 'var(--surface-2)',
              borderRadius: 10,
              cursor: 'pointer',
              border: '1px solid var(--surface-3)',
            }}
          >
            {groupClass.coach.avatarUrl ? (
              <img
                src={groupClass.coach.avatarUrl}
                alt={groupClass.coach.nickname}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--primary-dim)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#052e16',
                  border: '2px solid var(--primary-dim)',
                }}
              >
                {groupClass.coach.nickname.charAt(0)}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                {groupClass.coach.nickname}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>教练</div>
            </div>
            <span style={{ fontSize: 14, color: 'var(--text-3)' }}>›</span>
          </div>

          {/* Venue */}
          {groupClass.venue && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18, lineHeight: '22px', flexShrink: 0 }}>📍</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)' }}>
                  {groupClass.venue.name}
                </div>
                {groupClass.venue.address && (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                    {groupClass.venue.address}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Time */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 18, lineHeight: '22px', flexShrink: 0 }}>🕐</span>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-1)' }}>{formatDate(groupClass.startTime)}</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 2 }}>
                {formatTime(groupClass.startTime)} - {formatTime(groupClass.endTime)}
              </div>
            </div>
          </div>

          {/* Participant count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: groupClass.feeDescription ? 14 : 0,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: '22px', flexShrink: 0 }}>👥</span>
            <div style={{ fontSize: 14, color: 'var(--text-1)' }}>
              <span style={{ fontWeight: 600 }}>{groupClass.currentParticipants}</span>
              <span style={{ color: 'var(--text-3)' }}> / {groupClass.maxParticipants} 人</span>
            </div>
          </div>

          {/* Fee */}
          {groupClass.feeDescription && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: '22px', flexShrink: 0 }}>💰</span>
              <div style={{ fontSize: 14, color: 'var(--text-1)' }}>{groupClass.feeDescription}</div>
            </div>
          )}
        </div>

        {/* Enrollment list card */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>
            报名学员 ({groupClass.enrollments.length})
          </div>

          {groupClass.enrollments.length === 0 ? (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 20, fontSize: 14 }}>
              暂无学员报名
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupClass.enrollments.map((enrollment) => (
                <div
                  key={enrollment.userId}
                  onClick={() => navigate(`/profile/${enrollment.userId}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {enrollment.avatarUrl ? (
                    <img
                      src={enrollment.avatarUrl}
                      alt={enrollment.nickname}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--surface-2)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-1)',
                        border: '2px solid var(--surface-2)',
                      }}
                    >
                      {enrollment.nickname.charAt(0)}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
                      {enrollment.nickname}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {new Date(enrollment.enrolledAt).toLocaleDateString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                    })}
                    {' 报名'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status-specific notices */}
        {groupClass.status === 'in_progress' && (
          <div
            style={{
              background: 'rgba(96,165,250,0.15)',
              borderRadius: 12,
              padding: '14px 16px',
              color: 'var(--blue)',
              textAlign: 'center',
              fontSize: 14,
              border: '1px solid rgba(96,165,250,0.25)',
              marginBottom: 12,
            }}
          >
            🏸 课程进行中
          </div>
        )}

        {/* Completed actions */}
        {groupClass.status === 'completed' && (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: matchRecordsData?.items?.length ? 14 : 0,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>战绩记录</div>
              <button
                onClick={() =>
                  navigate(`/match-records/create?sourceType=group-class&sourceId=${groupClassId}`)
                }
                style={{
                  padding: '5px 14px',
                  background: 'var(--primary)',
                  color: '#052e16',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                + 录入战绩
              </button>
            </div>

            {matchRecordsData?.items && matchRecordsData.items.length === 0 && (
              <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 20, fontSize: 14 }}>
                暂无战绩记录
              </div>
            )}

            {matchRecordsData?.items?.map((record) => (
              <div
                key={record.id}
                style={{
                  padding: 14,
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  marginBottom: 10,
                  border: '1px solid var(--surface-3)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {record.games.map((g: { gameNumber: number; scoreA: number; scoreB: number }) => (
                    <span
                      key={g.gameNumber}
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-2)',
                        background: 'var(--surface)',
                        padding: '2px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--surface-3)',
                      }}
                    >
                      {g.scoreA}:{g.scoreB}
                    </span>
                  ))}
                </div>
                {record.recordedBy === currentUserId && (
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <button
                      onClick={() => {
                        setDeletingRecordId(record.id);
                        setShowDeleteConfirm(true);
                      }}
                      style={{
                        fontSize: 12,
                        color: 'var(--danger)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {groupClass.status === 'cancelled' && (
          <div
            style={{
              background: 'rgba(248,113,113,0.15)',
              borderRadius: 12,
              padding: '14px 16px',
              color: 'var(--danger)',
              textAlign: 'center',
              fontSize: 14,
              border: '1px solid rgba(248,113,113,0.25)',
              marginBottom: 12,
            }}
          >
            该团课已取消
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {(groupClass.status === 'open' || groupClass.status === 'full') && !isCoach && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            background: 'rgba(15,23,42,.95)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--surface-2)',
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          {groupClass.status === 'open' && !isEnrolled && (
            <button
              onClick={handleEnroll}
              disabled={enrollMutation.isPending}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'var(--primary)',
                color: '#052e16',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              立即报名
            </button>
          )}

          {(groupClass.status === 'open' || groupClass.status === 'full') && isEnrolled && (
            <button
              onClick={() => setShowCancelEnrollConfirm(true)}
              disabled={cancelEnrollMutation.isPending}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'var(--danger)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              取消报名
            </button>
          )}

          {groupClass.status === 'full' && !isEnrolled && (
            <button
              disabled
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'var(--surface-2)',
                color: 'var(--text-3)',
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
              }}
            >
              已满员
            </button>
          )}
        </div>
      )}

      {/* Cancel Enrollment Confirm Dialog */}
      {showCancelEnrollConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              width: '80%',
              maxWidth: 360,
            }}
          >
            <p style={{ marginTop: 0, fontSize: 15, color: 'var(--text-1)' }}>是否取消报名？</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCancelEnrollConfirm(false)}
                style={{
                  padding: '8px 20px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                返回
              </button>
              <button
                onClick={handleCancelEnrollment}
                style={{
                  padding: '8px 20px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                确认取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Record Confirm Dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              width: '80%',
              maxWidth: 360,
            }}
          >
            <p style={{ marginTop: 0, fontSize: 15, color: 'var(--text-1)' }}>确定删除战绩？</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingRecordId(null);
                }}
                style={{
                  padding: '8px 20px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                返回
              </button>
              <button
                onClick={handleDeleteRecord}
                style={{
                  padding: '8px 20px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
