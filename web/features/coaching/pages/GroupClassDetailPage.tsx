import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useGroupClassDetail } from '../hooks/useGroupClassDetail';
import { useEnrollGroupClass } from '../hooks/useEnrollGroupClass';
import { useCancelEnrollment } from '../hooks/useCancelEnrollment';
import { useGroupClassMatchRecords } from '../hooks/useGroupClassMatchRecords';
import { useDeleteMatchRecord } from '../hooks/useDeleteMatchRecord';

const STATUS_MAP: Record<string, string> = {
  open: '报名中',
  full: '已满员',
  in_progress: '进行中',
  completed: '已结束',
  cancelled: '已取消',
};

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

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败：团课不存在</div>;
  if (!groupClass) return null;

  const isCoach = currentUserId === groupClass.coachId;
  const isEnrolled = groupClass.enrollments.some((e) => e.userId === currentUserId);

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

  const renderActionButton = () => {
    if (isCoach) return null;

    if (groupClass.status === 'open' && !isEnrolled) {
      return (
        <button
          onClick={handleEnroll}
          disabled={enrollMutation.isPending}
          style={{
            padding: '8px 24px',
            background: '#00C853',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          报名
        </button>
      );
    }

    if ((groupClass.status === 'open' || groupClass.status === 'full') && isEnrolled) {
      return (
        <button
          onClick={() => setShowCancelEnrollConfirm(true)}
          disabled={cancelEnrollMutation.isPending}
          style={{
            padding: '8px 24px',
            background: '#ff5252',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          取消报名
        </button>
      );
    }

    if (groupClass.status === 'full' && !isEnrolled) {
      return (
        <button
          disabled
          style={{
            padding: '8px 24px',
            background: '#e0e0e0',
            color: '#999',
            border: 'none',
            borderRadius: '8px',
            width: '100%',
          }}
        >
          已满员
        </button>
      );
    }

    return null;
  };

  const renderStatusArea = () => {
    if (groupClass.status === 'completed') {
      return (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ color: '#1565c0', fontWeight: 500 }}>已结束</span>
          <button
            onClick={() =>
              navigate(`/match-records/create?sourceType=group-class&sourceId=${groupClassId}`)
            }
            style={{
              marginLeft: '12px',
              padding: '4px 12px',
              background: '#1565c0',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            录入战绩
          </button>
        </div>
      );
    }
    if (groupClass.status === 'cancelled') {
      return <div style={{ marginBottom: '16px', color: '#c62828', fontWeight: 500 }}>已取消</div>;
    }
    if (groupClass.status === 'in_progress') {
      return <div style={{ marginBottom: '16px', color: '#e65100', fontWeight: 500 }}>进行中</div>;
    }
    return null;
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
        <button
          aria-label="返回"
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
          }}
        >
          &lt; 返回
        </button>
      </div>

      {/* Status Tag - only for open/full status */}
      {(groupClass.status === 'open' || groupClass.status === 'full') && (
        <div style={{ marginBottom: '8px' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: 12,
              background: groupClass.status === 'open' ? '#e8f5e9' : '#fff3e0',
              color: groupClass.status === 'open' ? '#2e7d32' : '#e65100',
            }}
          >
            {STATUS_MAP[groupClass.status]}
          </span>
        </div>
      )}

      {/* Title */}
      <h2 style={{ margin: '0 0 12px 0' }}>{groupClass.title}</h2>

      {/* Coach Brief */}
      <div
        onClick={() => navigate(`/coaches/${groupClass.coachId}`)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          cursor: 'pointer',
        }}
      >
        {groupClass.coach.avatarUrl ? (
          <img
            src={groupClass.coach.avatarUrl}
            alt={groupClass.coach.nickname}
            style={{ width: 32, height: 32, borderRadius: '50%' }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            {groupClass.coach.nickname.charAt(0)}
          </div>
        )}
        <span style={{ fontWeight: 500 }}>{groupClass.coach.nickname}</span>
      </div>

      {/* Details */}
      <div style={{ marginBottom: '16px' }}>
        {groupClass.venue && (
          <div style={{ color: '#666', fontSize: 14 }}>{groupClass.venue.name}</div>
        )}
        <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
          {new Date(groupClass.startTime).toLocaleString()} -{' '}
          {new Date(groupClass.endTime).toLocaleTimeString()}
        </div>
        <div style={{ fontSize: 14, marginTop: 4 }}>
          {groupClass.currentParticipants}/{groupClass.maxParticipants}人
        </div>
        {groupClass.feeDescription && (
          <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            {groupClass.feeDescription}
          </div>
        )}
      </div>

      {/* Status Area (completed/cancelled/in_progress) */}
      {renderStatusArea()}

      {/* Action Button */}
      <div style={{ marginBottom: '16px' }}>{renderActionButton()}</div>

      {/* Enrollment List */}
      <div style={{ marginBottom: '16px' }}>
        <h3>报名学员 ({groupClass.enrollments.length})</h3>
        {groupClass.enrollments.map((enrollment) => (
          <div
            key={enrollment.userId}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}
          >
            {enrollment.avatarUrl ? (
              <img
                src={enrollment.avatarUrl}
                alt={enrollment.nickname}
                style={{ width: 32, height: 32, borderRadius: '50%' }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                {enrollment.nickname.charAt(0)}
              </div>
            )}
            <span>{enrollment.nickname}</span>
            <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>
              {new Date(enrollment.enrolledAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>

      {/* Match Records Section (only when completed) */}
      {groupClass.status === 'completed' && (
        <div>
          <h3>战绩</h3>
          {matchRecordsData?.items?.map((record) => (
            <div
              key={record.id}
              style={{
                padding: '8px',
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              <div style={{ fontSize: 12 }}>
                {record.games.map((g) => `${g.scoreA}:${g.scoreB}`).join(' / ')}
              </div>
              {record.recordedBy === currentUserId && (
                <button
                  onClick={() => {
                    setDeletingRecordId(record.id);
                    setShowDeleteConfirm(true);
                  }}
                  style={{
                    fontSize: 12,
                    color: '#ff5252',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: 4,
                  }}
                >
                  删除
                </button>
              )}
            </div>
          ))}
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
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '80%',
              maxWidth: '360px',
            }}
          >
            <p>是否取消报名？</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCancelEnrollConfirm(false)}
                style={{
                  padding: '6px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                返回
              </button>
              <button
                onClick={handleCancelEnrollment}
                style={{
                  padding: '6px 16px',
                  background: '#ff5252',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                确认
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
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '80%',
              maxWidth: '360px',
            }}
          >
            <p>确定删除战绩？</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingRecordId(null);
                }}
                style={{
                  padding: '6px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                返回
              </button>
              <button
                onClick={handleDeleteRecord}
                style={{
                  padding: '6px 16px',
                  background: '#ff5252',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
