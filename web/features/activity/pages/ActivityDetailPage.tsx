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
import { BackButton } from '../../../shared/components/BackButton';
import { DateTimePicker } from '../../../shared/components/DateTimePicker';
import type { MatchRecord } from '../api/activity-api';
import { STATUS_LABELS } from '../constants';
import { VenueSearchInput } from '../components/venue-search-input';
import type { VenueSearchItem } from '../api/venue-api';

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
      return { bg: '#e8f5e9', color: '#2e7d32', border: '#c8e6c9' };
    case 'full':
      return { bg: '#fff3e0', color: '#e65100', border: '#ffe0b2' };
    case 'in_progress':
      return { bg: '#e3f2fd', color: '#1565c0', border: '#bbdefb' };
    case 'completed':
      return { bg: '#f3e5f5', color: '#7b1fa2', border: '#e1bee7' };
    case 'cancelled':
      return { bg: '#fce4ec', color: '#c62828', border: '#f8bbd0' };
    default:
      return { bg: '#f5f5f5', color: '#999', border: '#e0e0e0' };
  }
}

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
  const [editVenue, setEditVenue] = useState<VenueSearchItem | null>(null);
  const [editVenueError, setEditVenueError] = useState('');
  const [editForm, setEditForm] = useState({
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
  const isParticipant = activity?.participants.some((p) => p.userId === currentUserId);

  // Loading state
  if (activityQuery.isLoading) {
    return <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>;
  }

  // Error state
  if (activityQuery.error) {
    const err = activityQuery.error as { code?: string };
    if (err.code === 'ACTIVITY_NOT_FOUND') {
      return <div style={{ textAlign: 'center', padding: 48 }}>活动不存在</div>;
    }
    return <div style={{ textAlign: 'center', padding: 48, color: 'red' }}>加载失败，请重试</div>;
  }

  if (!activity) return null;

  // Enter edit mode
  const handleEditClick = () => {
    setEditVenue(activity.venue);
    setEditVenueError('');
    setEditForm({
      title: activity.title || '',
      startTime: activity.startTime,
      endTime: activity.endTime,
      maxParticipants: activity.maxParticipants,
    });
    setIsEditMode(true);
  };

  // Save edit
  const handleSave = () => {
    if (!editVenue) {
      setEditVenueError('请选择球馆');
      return;
    }

    updateMutation.mutate(
      {
        activityId: activityId!,
        data: {
          ...(editVenue.id !== activity.venue?.id && {
            venueId: editVenue.id,
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
    setEditVenueError('');
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
  const statusStyle = getStatusStyle(activity.status);

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <BackButton onClick={() => navigate(-1)} style={{ padding: '4px 0', marginRight: 12 }} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>约球详情</h2>
      </div>

      {/* Main content */}
      <div style={{ padding: '12px 16px' }}>
        {/* Activity info card / Edit form */}
        {isEditMode ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#666' }}>球馆</label>
              <VenueSearchInput
                selectedVenue={editVenue}
                onChangeSelection={(venue) => {
                  setEditVenue(venue);
                  if (venue) {
                    setEditVenueError('');
                  }
                }}
                placeholder="搜索球馆"
                error={editVenueError}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#666' }}>标题</label>
              <input
                type="text"
                placeholder="活动标题"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  marginTop: 4,
                  boxSizing: 'border-box',
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <DateTimePicker
                label="开始时间"
                value={editForm.startTime || undefined}
                onChange={(iso) =>
                  setEditForm({ ...editForm, startTime: iso })
                }
                placeholder="选择开始时间"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <DateTimePicker
                label="结束时间"
                value={editForm.endTime || undefined}
                onChange={(iso) =>
                  setEditForm({ ...editForm, endTime: iso })
                }
                placeholder="选择结束时间"
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
                  padding: '8px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  marginTop: 4,
                  boxSizing: 'border-box',
                  fontSize: 14,
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              marginBottom: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            {/* Status + Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
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
                {STATUS_LABELS[activity.status] || activity.status}
              </span>
              {activity.title && (
                <span style={{ fontSize: 13, color: '#666' }}>{activity.title}</span>
              )}
            </div>

            {/* Venue info with icon */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18, lineHeight: '22px', flexShrink: 0 }}>📍</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>{venueName}</div>
                {venueAddress && (
                  <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{venueAddress}</div>
                )}
              </div>
            </div>

            {/* Time info with icon */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18, lineHeight: '22px', flexShrink: 0 }}>🕐</span>
              <div>
                <div style={{ fontSize: 14, color: '#333' }}>{formatDate(activity.startTime)}</div>
                <div style={{ fontSize: 14, color: '#555', marginTop: 2 }}>
                  {formatTime(activity.startTime)} - {formatTime(activity.endTime)}
                </div>
              </div>
            </div>

            {/* Participant count with icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: '22px', flexShrink: 0 }}>👥</span>
              <div style={{ fontSize: 14, color: '#333' }}>
                <span style={{ fontWeight: 600 }}>{activity.currentParticipants}</span>
                <span style={{ color: '#999' }}> / {activity.maxParticipants} 人</span>
              </div>
            </div>
          </div>
        )}

        {/* Participants card */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 20,
            marginBottom: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: 14 }}>
            参与者
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activity.participants.map((p) => (
              <div
                key={p.userId}
                onClick={() => navigate(`/profile/${p.userId}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  padding: '6px 8px',
                  borderRadius: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f8f8')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {p.avatarUrl ? (
                  <img
                    src={p.avatarUrl}
                    alt={p.nickname}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #f0f0f0',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #e0e0e0, #bdbdbd)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#fff',
                      border: '2px solid #f0f0f0',
                    }}
                  >
                    {p.nickname.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>{p.nickname}</span>
                </div>
                {p.userId === activity.creatorId && (
                  <span
                    aria-label="发起人标识"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: '#fff3e0',
                      color: '#e65100',
                      border: '1px solid #ffe0b2',
                    }}
                  >
                    发起人
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Match records card */}
        {(activity.status === 'completed' || (matchRecords && matchRecords.length > 0)) && (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              marginBottom: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: 14 }}>
              战绩记录
            </div>
            {matchRecordsQuery.isLoading && (
              <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>加载战绩中...</div>
            )}
            {matchRecords && matchRecords.length === 0 && (
              <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>暂无战绩记录</div>
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
              background: '#e3f2fd',
              borderRadius: 12,
              padding: '14px 16px',
              color: '#1565c0',
              textAlign: 'center',
              fontSize: 14,
              border: '1px solid #bbdefb',
            }}
          >
            🏸 活动进行中，结束后可录入战绩
          </div>
        )}
      </div>

      {/* Bottom action bar */}
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
                fontSize: 15,
                fontWeight: 500,
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
                fontSize: 15,
              }}
            >
              取消编辑
            </button>
          </>
        ) : (
          <>
            {/* Creator actions: open/full */}
            {isCreator && (activity.status === 'open' || activity.status === 'full') && (
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
                    fontSize: 15,
                    fontWeight: 500,
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
                    fontSize: 15,
                    fontWeight: 500,
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
                    fontSize: 15,
                    fontWeight: 500,
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
                  fontSize: 15,
                  fontWeight: 500,
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
                  fontSize: 15,
                }}
              >
                已满员
              </button>
            )}

            {/* Completed: record match */}
            {isParticipant && activity.status === 'completed' && (
              <button
                onClick={() =>
                  navigate(`/match-records/create?sourceType=activity&sourceId=${activityId}`)
                }
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: '#00C853',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 500,
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
        padding: 14,
        background: '#fafafa',
        borderRadius: 10,
        marginBottom: 10,
        border: '1px solid #f0f0f0',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 8,
            background: record.matchType === 'singles' ? '#e8f5e9' : '#e3f2fd',
            color: record.matchType === 'singles' ? '#2e7d32' : '#1565c0',
          }}
        >
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
              fontSize: 13,
            }}
          >
            删除
          </button>
        )}
      </div>

      {/* Players vs display */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          {sideA.map((p, i) => (
            <div key={i} style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
              {p.nickname}
            </div>
          ))}
        </div>
        <span
          style={{
            fontSize: 12,
            color: '#bbb',
            fontWeight: 600,
            padding: '0 12px',
          }}
        >
          VS
        </span>
        <div style={{ flex: 1, textAlign: 'center' }}>
          {sideB.map((p, i) => (
            <div key={i} style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
              {p.nickname}
            </div>
          ))}
        </div>
      </div>

      {/* Scores */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {record.games.map((game) => (
          <span
            key={game.gameNumber}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#555',
              background: '#fff',
              padding: '2px 10px',
              borderRadius: 6,
              border: '1px solid #e0e0e0',
            }}
          >
            {game.scoreA}:{game.scoreB}
          </span>
        ))}
      </div>
    </div>
  );
}
