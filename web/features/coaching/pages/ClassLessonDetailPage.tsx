import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BackButton } from '../../../shared/components/BackButton';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { useClassLessonDetail } from '../hooks/useClassLessonDetail';
import { useLessonNotes } from '../hooks/useLessonNotes';
import { useUpdateTrainingContent } from '../hooks/useUpdateTrainingContent';
import { useAddLessonNote } from '../hooks/useAddLessonNote';
import { useCancelClassLesson } from '../hooks/useCancelClassLesson';

const statusMap: Record<string, { label: string; variant: 'green' | 'blue' | 'gray' | 'red' }> = {
  scheduled: { label: '未开始', variant: 'blue' },
  in_progress: { label: '进行中', variant: 'green' },
  completed: { label: '已结束', variant: 'gray' },
  cancelled: { label: '已取消', variant: 'red' },
};

export function ClassLessonDetailPage() {
  const { classId, lessonId } = useParams<{ classId: string; lessonId: string }>();
  const navigate = useNavigate();

  const { data: lesson, isLoading } = useClassLessonDetail(classId || '', lessonId || '');
  const { data: notesData } = useLessonNotes(classId || '', lessonId || '');
  const updateTrainingMutation = useUpdateTrainingContent();
  const addNoteMutation = useAddLessonNote();
  const cancelLessonMutation = useCancelClassLesson();

  const [isEditingContent, setIsEditingContent] = useState(false);
  const [trainingContent, setTrainingContent] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (isLoading) return <div style={{ padding: 16 }}>加载中...</div>;
  if (!lesson) return <div style={{ padding: 16 }}>课程不存在</div>;

  const statusInfo = statusMap[lesson.status] || { label: lesson.status, variant: 'gray' as const };
  const notes = notesData?.items ?? [];
  const isCancelled = lesson.status === 'cancelled';

  const handleSaveTrainingContent = () => {
    if (!classId || !lessonId) return;
    updateTrainingMutation.mutate(
      { classId, lessonId, content: trainingContent },
      {
        onSuccess: () => {
          setIsEditingContent(false);
        },
      },
    );
  };

  const handleAddNote = () => {
    if (!classId || !lessonId || !noteInput.trim()) return;
    addNoteMutation.mutate(
      { classId, lessonId, content: noteInput.trim() },
      {
        onSuccess: () => {
          setNoteInput('');
        },
      },
    );
  };

  const handleCancel = () => {
    if (!classId || !lessonId) return;
    cancelLessonMutation.mutate(
      { classId, lessonId },
      {
        onSuccess: () => {
          setShowCancelConfirm(false);
        },
      },
    );
  };

  return (
    <div style={{ padding: 16 }}>
      <BackButton onClick={() => navigate(`/my-student-classes/${classId}`)} />

      {/* Lesson Info */}
      <div style={{ margin: '16px 0', padding: 16, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--surface-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>课程详情</h3>
          <StatusBadge variant={statusInfo.variant}>{statusInfo.label}</StatusBadge>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-1)', marginBottom: 6 }}>
          {new Date(lesson.startTime).toLocaleDateString()}{' '}
          {new Date(lesson.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {' - '}
          {new Date(lesson.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
          {lesson.venue?.name || '地点待定'}
          {lesson.venue?.address && ` · ${lesson.venue.address}`}
        </div>

        {lesson.status === 'scheduled' && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowCancelConfirm(true)}
              style={{
                fontSize: 12,
                padding: '4px 12px',
                border: '1px solid var(--danger)',
                borderRadius: 4,
                background: 'transparent',
                color: 'var(--danger)',
                cursor: 'pointer',
              }}
            >
              取消课程
            </button>
          </div>
        )}
      </div>

      {/* Training Content */}
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--surface-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>训练内容</h3>
          {!isCancelled && !isEditingContent && (
            <button
              onClick={() => {
                setTrainingContent(lesson.trainingContent || '');
                setIsEditingContent(true);
              }}
              style={{
                fontSize: 12,
                padding: '4px 12px',
                border: '1px solid var(--surface-2)',
                borderRadius: 4,
                background: 'var(--surface-2)',
                color: 'var(--text-1)',
                cursor: 'pointer',
              }}
            >
              编辑
            </button>
          )}
        </div>

        {isEditingContent ? (
          <div>
            <textarea
              value={trainingContent}
              onChange={(e) => setTrainingContent(e.target.value)}
              placeholder="填写训练内容（最多 2000 字）"
              rows={5}
              style={{
                width: '100%',
                padding: 10,
                boxSizing: 'border-box',
                border: '1px solid var(--surface-2)',
                borderRadius: 8,
                background: 'var(--surface-2)',
                color: 'var(--text-1)',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setIsEditingContent(false)}
                style={{ padding: '6px 16px', border: '1px solid var(--surface-2)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-1)', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleSaveTrainingContent}
                disabled={updateTrainingMutation.isPending}
                style={{ padding: '6px 16px', background: 'var(--primary)', color: '#052e16', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: lesson.trainingContent ? 'var(--text-1)' : 'var(--text-3)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {lesson.trainingContent || '暂无训练内容'}
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--surface-2)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>课程笔记</h3>

        {!isCancelled && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="输入笔记内容"
              style={{
                flex: 1,
                padding: 10,
                boxSizing: 'border-box',
                border: '1px solid var(--surface-2)',
                borderRadius: 8,
                background: 'var(--surface-2)',
                color: 'var(--text-1)',
                fontSize: 14,
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={addNoteMutation.isPending || !noteInput.trim()}
              style={{
                padding: '8px 16px',
                background: 'var(--primary)',
                color: '#052e16',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              添加
            </button>
          </div>
        )}

        {notes.length === 0 ? (
          <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 12 }}>暂无笔记</div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--surface-2)',
              }}
            >
              <div style={{ fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5 }}>{note.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {new Date(note.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Match Records Link */}
      {(lesson.status === 'in_progress' || lesson.status === 'completed') && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--surface-2)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>战绩</h3>
          <button
            onClick={() => navigate('/match-records/create')}
            style={{
              padding: '8px 16px',
              background: 'var(--primary)',
              color: '#052e16',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            录入战绩
          </button>
        </div>
      )}

      {/* Cancel Confirm */}
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
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '80%', maxWidth: 360 }}>
            <p>确认取消该课程？取消后不可恢复。</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{ padding: '6px 16px', border: '1px solid var(--surface-2)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-1)', cursor: 'pointer' }}
              >
                返回
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLessonMutation.isPending}
                style={{ padding: '6px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                确认取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
