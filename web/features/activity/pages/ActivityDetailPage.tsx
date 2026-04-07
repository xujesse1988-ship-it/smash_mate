import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useActivityDetail } from '../hooks/useActivityDetail';
import { useActivityMatchRecords } from '../hooks/useActivityMatchRecords';
import { useJoinActivity } from '../hooks/useJoinActivity';
import { useLeaveActivity } from '../hooks/useLeaveActivity';
import { useUpdateActivity } from '../hooks/useUpdateActivity';
import { useCancelActivity } from '../hooks/useCancelActivity';
import { useDeleteMatchRecord } from '../hooks/useDeleteMatchRecord';
import type { MatchRecord } from '../hooks/useActivityMatchRecords';

// ---------------------------------------------------------------------------
// Status label map
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  open: '报名中',
  full: '已满员',
  in_progress: '进行中',
  completed: '已结束',
  cancelled: '已取消',
};

// ---------------------------------------------------------------------------
// ActivityDetailPage
// ---------------------------------------------------------------------------

export function ActivityDetailPage() {
  const navigate = useNavigate();
  const { id: activityId } = useParams<{ id: string }>();
  const currentUserId = useAuthStore((state) => state.userId);

  const activityQuery = useActivityDetail(activityId || '');
  const matchRecordsQuery = useActivityMatchRecords(activityId || '');

  const joinMutation = useJoinActivity();
  const leaveMutation = useLeaveActivity();
  const updateMutation = useUpdateActivity();
  const cancelMutation = useCancelActivity();
  const deleteRecordMutation = useDeleteMatchRecord(activityId || '');

  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    venueId: '',
    title: '',
    startTime: '',
    endTime: '',
    maxParticipants: 0,
  });
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  const activity = activityQuery.data;
  const matchRecords = matchRecordsQuery.data;

  // Determine user role
  const isCreator = activity?.creatorId === currentUserId;
  const isParticipant = activity?.participants.some(
    (p) => p.userId === currentUserId,
  );

  // Loading state
  if (activityQuery.isLoading) {
    return <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>;
  }

  // Error state
  if (activityQuery.error) {
    const err = activityQuery.error as { code?: string };
    if (err.code === 'ACTIVITY_NOT_FOUND') {
      return (
        <div style={{ textAlign: 'center', padding: 48 }}>活动不存在</div>
      );
    }
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'red' }}>
        加载失败，请重试
      </div>
    );
  }

  if (!activity) return null;

  // Enter edit mode
  const handleEditClick = () => {
    setEditForm({
      venueId: activity.venue?.id || '',
      title: activity.title || '',
      startTime: activity.startTime,
      endTime: activity.endTime,
      maxParticipants: activity.maxParticipants,
    });
    setIsEditMode(true);
  };

  // Save edit
  const handleSave = () => {
    updateMutation.mutate(
      {
        activityId: activityId!,
        data: {
          ...(editForm.venueId !== activity.venue?.id && {
            venueId: editForm.venueId,
          }),
          ...(editForm.title !== (activity.title || '') && {
            title: editForm.title,
          }),
          ...(editForm.startTime !== activity.startTime && {
            startTime: editForm.startTime,
          }),
          ...(editForm.endTime !== activity.endTime && {
            endTime: editForm.endTime,
          }),
          ...(editForm.maxParticipants !== activity.maxParticipants && {
            maxParticipants: editForm.maxParticipants,
          }),
        },
      },
      {
        onSuccess: () => {
          setIsEditMode(false);
        },
      },
    );
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  // Confirm leave
  const handleLeaveConfirm = () => {
    leaveMutation.mutate(activityId!);
    setShowLeaveConfirm(false);
  };

  // Confirm cancel activity
  const handleCancelActivityConfirm = () => {
    cancelMutation.mutate(activityId!);
    setShowCancelConfirm(false);
  };

  // Confirm delete match record
  const handleDeleteRecordConfirm = () => {
    if (deletingRecordId) {
      deleteRecordMutation.mutate(deletingRecordId);
    }
    setShowDeleteConfirm(false);
    setDeletingRecordId(null);
  };

  const venueName = activity.venue?.name || '已删除的球馆';
  const venueAddress = activity.venue?.address || '';

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
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
          }}
        >
          &lt;
        </button>
        <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>
          {activity.title || venueName}
        </h2>
      </div>

      {/* Status tag */}
      <div style={{ padding: '8px 16px' }}>
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 4,
            background:
              activity.status === 'open'
                ? '#e6f7ff'
                : activity.status === 'cancelled'
                  ? '#fff1f0'
                  : '#f5f5f5',
            color:
              activity.status === 'open'
                ? '#1890ff'
                : activity.status === 'cancelled'
                  ? '#ff4d4f'
                  : '#999',
          }}
        >
          {STATUS_LABELS[activity.status] || activity.status}
        </span>
      </div>

      {/* Activity info section / Edit form */}
      {isEditMode ? (
        <div style={{ padding: '0 16px' }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: '#666' }}>球馆</label>
            <input
              type="text"
              placeholder="搜索球馆"
              value={editForm.venueId}
              onChange={(e) =>
                setEditForm({ ...editForm, venueId: e.target.value })
              }
              style={{
                width: '100%',
                padding: '4px 8px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: '#666' }}>标题</label>
            <input
              type="text"
              placeholder="活动标题"
              value={editForm.title}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
              style={{
                width: '100%',
                padding: '4px 8px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: '#666' }}>限定人数</label>
            <input
              type="number"
              min={2}
              max={50}
              value={editForm.maxParticipants}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  maxParticipants: parseInt(e.target.value, 10) || 0,
                })
              }
              style={{
                width: '100%',
                padding: '4px 8px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {/* Venue info */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{venueName}</div>
            {venueAddress && (
              <div style={{ fontSize: 13, color: '#666' }}>{venueAddress}</div>
            )}
          </div>
          {/* Time info */}
          <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
            {new Date(activity.startTime).toLocaleString()} -{' '}
            {new Date(activity.endTime).toLocaleString()}
          </div>
          {/* Participant count */}
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            {activity.currentParticipants}/{activity.maxParticipants} 人
          </div>
        </div>
      )}

      {/* Participants section */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>参与者</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {activity.participants.map((p) => (
            <div
              key={p.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: p.avatarUrl ? `url(${p.avatarUrl})` : '#ddd',
                  backgroundSize: 'cover',
                }}
              />
              <div>
                <span style={{ fontSize: 13 }}>{p.nickname}</span>
                {p.userId === activity.creatorId && (
                  <span
                    aria-label="发起人标识"
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#ff9800',
                      marginLeft: 4,
                    }}
                    title="发起人"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Match records section */}
      {(activity.status === 'completed' || matchRecords?.length) && (
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>战绩记录</h3>
          {matchRecordsQuery.isLoading && (
            <div style={{ color: '#999' }}>加载战绩中...</div>
          )}
          {matchRecords && matchRecords.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>
              暂无战绩记录
            </div>
          )}
          {matchRecords &&
            matchRecords.map((record: MatchRecord) => (
              <MatchRecordCard
                key={record.id}
                record={record}
                currentUserId={currentUserId}
                onDelete={() => {
                  setDeletingRecordId(record.id);
                  setShowDeleteConfirm(true);
                }}
              />
            ))}
        </div>
      )}

      {/* In-progress hint */}
      {activity.status === 'in_progress' && isParticipant && (
        <div
          style={{
            padding: '12px 16px',
            color: '#666',
            textAlign: 'center',
            fontSize: 14,
          }}
        >
          活动进行中，结束后可录入战绩
        </div>
      )}

      {/* Action bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
        }}
      >
        {isEditMode ? (
          <>
            <button
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '10px 0',
                background: '#00C853',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              保存
            </button>
            <button
              onClick={handleCancelEdit}
              style={{
                flex: 1,
                padding: '10px 0',
                background: '#f5f5f5',
                color: '#666',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              取消编辑
            </button>
          </>
        ) : (
          <>
            {/* Creator actions: open/full */}
            {isCreator &&
              (activity.status === 'open' || activity.status === 'full') && (
                <>
                  <button
                    onClick={handleEditClick}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: '#1890ff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    编辑活动
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: '#ff4d4f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    取消活动
                  </button>
                </>
              )}

            {/* Participant (non-creator) actions: open/full */}
            {!isCreator &&
              isParticipant &&
              (activity.status === 'open' || activity.status === 'full') && (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    background: '#ff9800',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  退出活动
                </button>
              )}

            {/* Non-participant join: open */}
            {!isParticipant && activity.status === 'open' && (
              <button
                onClick={() => joinMutation.mutate(activityId!)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: '#00C853',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                加入活动
              </button>
            )}

            {/* Non-participant full: disabled button */}
            {!isParticipant && activity.status === 'full' && (
              <button
                disabled
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: '#f5f5f5',
                  color: '#999',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'not-allowed',
                }}
              >
                已满员
              </button>
            )}

            {/* Completed: record match */}
            {isParticipant && activity.status === 'completed' && (
              <button
                onClick={() =>
                  navigate(
                    `/match-records/create?sourceType=activity&sourceId=${activityId}`,
                  )
                }
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: '#00C853',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                录入战绩
              </button>
            )}
          </>
        )}
      </div>

      {/* Leave confirm dialog */}
      {showLeaveConfirm && (
        <ConfirmDialog
          message="是否退出该活动？"
          onConfirm={handleLeaveConfirm}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}

      {/* Cancel activity confirm dialog */}
      {showCancelConfirm && (
        <ConfirmDialog
          message="取消后不可恢复，所有参与者将收到通知"
          onConfirm={handleCancelActivityConfirm}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {/* Delete match record confirm dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          message="是否删除这条战绩记录？"
          onConfirm={handleDeleteRecordConfirm}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeletingRecordId(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
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
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 320,
          width: '90%',
        }}
      >
        <div style={{ marginBottom: 16, fontSize: 14 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '8px 0',
              background: '#00C853',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            确认
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '8px 0',
              background: '#f5f5f5',
              color: '#666',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MatchRecordCard
// ---------------------------------------------------------------------------

function MatchRecordCard({
  record,
  currentUserId,
  onDelete,
}: {
  record: MatchRecord;
  currentUserId: string | null;
  onDelete: () => void;
}) {
  const sideA = record.players.sideA;
  const sideB = record.players.sideB;
  const isRecorder = record.recordedBy === currentUserId;

  return (
    <div
      style={{
        padding: 12,
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, color: '#999' }}>
          {record.matchType === 'singles' ? '单打' : '双打'}
        </span>
        {isRecorder && (
          <button
            aria-label="删除战绩"
            onClick={onDelete}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#ff4d4f',
              fontSize: 14,
            }}
          >
            删除
          </button>
        )}
      </div>

      {/* Players */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          {sideA.map((p, i) => (
            <span key={i} style={{ fontSize: 14 }}>
              {p.nickname}
            </span>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#999' }}>vs</span>
        <div>
          {sideB.map((p, i) => (
            <span key={i} style={{ fontSize: 14 }}>
              {p.nickname}
            </span>
          ))}
        </div>
      </div>

      {/* Scores */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {record.games.map((game) => (
          <span key={game.gameNumber} style={{ fontSize: 13, color: '#666' }}>
            {game.scoreA}:{game.scoreB}
          </span>
        ))}
      </div>
    </div>
  );
}
