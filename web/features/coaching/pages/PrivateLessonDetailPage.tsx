import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { CoachGuard } from '../../../shared/components/CoachGuard';
import { BackButton } from '../../../shared/components/BackButton';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import {
  getPrivateLessonDetail,
  getPrivateLessonNotes,
  addPrivateLessonNote,
  updatePrivateLessonTrainingContent,
  cancelPrivateLessonV2,
} from '../api/private-student-api';

function lessonStatusBadge(status: string) {
  switch (status) {
    case 'scheduled':
      return <StatusBadge variant="green">未开始</StatusBadge>;
    case 'in_progress':
      return <StatusBadge variant="yellow">进行中</StatusBadge>;
    case 'completed':
      return <StatusBadge variant="blue">已结束</StatusBadge>;
    case 'cancelled':
      return <StatusBadge variant="gray">已取消</StatusBadge>;
    default:
      return <StatusBadge variant="gray">{status}</StatusBadge>;
  }
}

export function PrivateLessonDetailPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const privateStudentId = id || '';
  const privateLessonId = lessonId || '';

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isEditingTraining, setIsEditingTraining] = useState(false);
  const [editTrainingContent, setEditTrainingContent] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { data: lessonDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['private-students', privateStudentId, 'lessons', privateLessonId],
    queryFn: () => getPrivateLessonDetail(privateStudentId, privateLessonId),
    enabled: !!privateStudentId && !!privateLessonId,
  });

  const { data: notesData } = useQuery({
    queryKey: ['private-students', privateStudentId, 'lessons', privateLessonId, 'notes'],
    queryFn: () => getPrivateLessonNotes(privateStudentId, privateLessonId),
    enabled: !!privateStudentId && !!privateLessonId,
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) =>
      addPrivateLessonNote(privateStudentId, privateLessonId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['private-students', privateStudentId, 'lessons', privateLessonId, 'notes'],
      });
      setShowNoteModal(false);
      setNoteContent('');
      message.success('笔记添加成功');
    },
    onError: (error: Error) => {
      message.error(error.message || '添加失败');
    },
  });

  const updateTrainingMutation = useMutation({
    mutationFn: (content: string) =>
      updatePrivateLessonTrainingContent(privateStudentId, privateLessonId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['private-students', privateStudentId, 'lessons', privateLessonId],
      });
      setIsEditingTraining(false);
      message.success('训练内容已更新');
    },
    onError: (error: Error) => {
      message.error(error.message || '更新失败');
    },
  });

  const cancelLessonMutation = useMutation({
    mutationFn: () => cancelPrivateLessonV2(privateStudentId, privateLessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['private-students', privateStudentId, 'lessons', privateLessonId],
      });
      queryClient.invalidateQueries({
        queryKey: ['private-students', privateStudentId, 'lessons'],
      });
      setShowCancelConfirm(false);
      message.success('课程已取消');
    },
    onError: (error: Error) => {
      message.error(error.message || '取消失败');
    },
  });

  if (isUserLoading) return <div>加载中...</div>;
  if (currentUser && !currentUser.isCoach) {
    return (
      <CoachGuard onNavigateToSettings={() => navigate('/settings')} message="请先开启教练角色" />
    );
  }

  if (isDetailLoading) {
    return <div style={{ padding: 16, color: 'var(--text-3)', textAlign: 'center' }}>加载中...</div>;
  }

  if (!lessonDetail) {
    return <div style={{ padding: 16, color: 'var(--text-3)', textAlign: 'center' }}>课程不存在</div>;
  }

  const notes = notesData?.items ?? [];
  const isCancelled = lessonDetail.status === 'cancelled';

  return (
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <BackButton
          onClick={() => navigate(`/my-private-students/${privateStudentId}`)}
          style={{ marginBottom: 12, padding: '6px 0' }}
        />

        {/* Lesson info card */}
        <div className="dark-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>课程详情</h3>
            {lessonStatusBadge(lessonDetail.status)}
          </div>

          <div className="info-row">
            <span className="icon">📅</span>
            {new Date(lessonDetail.startTime).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              weekday: 'short',
            })}{' '}
            {new Date(lessonDetail.startTime).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' - '}
            {new Date(lessonDetail.endTime).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>

          {lessonDetail.venue && (
            <div className="info-row">
              <span className="icon">📍</span>
              {lessonDetail.venue.name}
            </div>
          )}

          {/* Actions for scheduled lessons */}
          {lessonDetail.status === 'scheduled' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="btn-dark btn-danger btn-sm"
                data-testid="cancel-lesson-btn"
              >
                取消课程
              </button>
            </div>
          )}
        </div>

        {/* Training content */}
        <div style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 8px' }}>训练内容</div>
        <div className="dark-card" style={{ marginBottom: 16 }}>
          {isEditingTraining ? (
            <div>
              <textarea
                value={editTrainingContent}
                onChange={(e) => setEditTrainingContent(e.target.value)}
                maxLength={2000}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg)',
                  border: '1.5px solid var(--surface-2)',
                  borderRadius: 10,
                  color: 'var(--text-1)',
                  fontSize: 14,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => setIsEditingTraining(false)}
                  className="btn-dark btn-sm"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
                >
                  取消
                </button>
                <button
                  onClick={() => updateTrainingMutation.mutate(editTrainingContent)}
                  disabled={updateTrainingMutation.isPending}
                  className="btn-dark btn-primary btn-sm"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, minHeight: 24 }}>
                {lessonDetail.trainingContent || (
                  <span style={{ color: 'var(--text-3)' }}>暂无训练内容</span>
                )}
              </div>
              {!isCancelled && (
                <button
                  onClick={() => {
                    setEditTrainingContent(lessonDetail.trainingContent || '');
                    setIsEditingTraining(true);
                  }}
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: 'var(--primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  data-testid="edit-training-btn"
                >
                  编辑训练内容
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notes section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>课程笔记</div>
          {!isCancelled && (
            <button
              onClick={() => setShowNoteModal(true)}
              style={{
                fontSize: 12,
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              data-testid="add-lesson-note-btn"
            >
              + 添加笔记
            </button>
          )}
        </div>

        {notes.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '8px 0' }}>暂无笔记</div>
        )}

        {notes.map((note) => (
          <div
            key={note.id}
            style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--surface-2)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
              {new Date(note.createdAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {note.content}
            </div>
          </div>
        ))}

        {/* Match records link */}
        {(lessonDetail.status === 'in_progress' || lessonDetail.status === 'completed') && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>战绩</div>
            <button
              onClick={() =>
                navigate(
                  `/match-records/create?sourceType=private_lesson_v2&sourceId=${privateLessonId}`,
                )
              }
              className="btn-dark btn-outline btn-sm"
              data-testid="record-lesson-match-btn"
            >
              + 录入战绩
            </button>
          </>
        )}

        {/* Cancel lesson confirm */}
        {showCancelConfirm && (
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
              <p style={{ marginBottom: 16 }}>确定取消该课程？取消后不可恢复。</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="btn-dark btn-sm"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
                >
                  返回
                </button>
                <button
                  onClick={() => cancelLessonMutation.mutate()}
                  className="btn-dark btn-sm"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                  data-testid="confirm-cancel-lesson-btn"
                >
                  确认取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add note modal */}
        {showNoteModal && (
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
                width: '90%',
                maxWidth: 400,
              }}
            >
              <h3 style={{ marginBottom: 12 }}>添加课程笔记</h3>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="输入笔记内容（最多 500 字符）"
                maxLength={500}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--surface-2)',
                  borderRadius: 10,
                  color: 'var(--text-1)',
                  fontSize: 14,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  onClick={() => {
                    setShowNoteModal(false);
                    setNoteContent('');
                  }}
                  className="btn-dark btn-sm"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (!noteContent.trim()) {
                      message.error('笔记内容不能为空');
                      return;
                    }
                    addNoteMutation.mutate(noteContent.trim());
                  }}
                  disabled={addNoteMutation.isPending}
                  className="btn-dark btn-primary btn-sm"
                >
                  提交
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
