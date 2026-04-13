import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { CoachGuard } from '../../../shared/components/CoachGuard';
import { BackButton } from '../../../shared/components/BackButton';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { DateTimePicker } from '../../../shared/components/DateTimePicker';
import { VenueSearchInput } from '../../activity/components/venue-search-input';
import type { VenueSearchItem } from '../../activity/api/venue-api';
import {
  getPrivateStudentDetail,
  getPrivateLessons,
  getPrivateStudentNotes,
  getPrivateStudentTags,
  addPrivateStudentNote,
  setPrivateStudentTags,
  removePrivateStudent,
  createPrivateLesson,
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

export function PrivateStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);
  const [lessonStartTime, setLessonStartTime] = useState('');
  const [lessonEndTime, setLessonEndTime] = useState('');
  const [lessonVenue, setLessonVenue] = useState<VenueSearchItem | null>(null);
  const [lessonTrainingContent, setLessonTrainingContent] = useState('');

  const privateStudentId = id || '';

  const { data: studentDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['private-students', privateStudentId],
    queryFn: () => getPrivateStudentDetail(privateStudentId),
    enabled: !!privateStudentId,
  });

  const { data: lessonsData } = useQuery({
    queryKey: ['private-students', privateStudentId, 'lessons'],
    queryFn: () => getPrivateLessons(privateStudentId),
    enabled: !!privateStudentId,
  });

  const { data: notesData } = useQuery({
    queryKey: ['private-students', privateStudentId, 'notes'],
    queryFn: () => getPrivateStudentNotes(privateStudentId),
    enabled: !!privateStudentId,
  });

  const { data: tagsData } = useQuery({
    queryKey: ['private-students', privateStudentId, 'tags'],
    queryFn: () => getPrivateStudentTags(privateStudentId),
    enabled: !!privateStudentId,
  });

  const removeMutation = useMutation({
    mutationFn: () => removePrivateStudent(privateStudentId),
    onSuccess: () => {
      message.success('已移除');
      navigate('/my-private-students');
    },
    onError: (error: Error) => {
      message.error(error.message || '移除失败');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => addPrivateStudentNote(privateStudentId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-students', privateStudentId, 'notes'] });
      setShowNoteModal(false);
      setNoteContent('');
      message.success('笔记添加成功');
    },
    onError: (error: Error) => {
      message.error(error.message || '添加失败');
    },
  });

  const setTagsMutation = useMutation({
    mutationFn: (tags: string[]) => setPrivateStudentTags(privateStudentId, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-students', privateStudentId, 'tags'] });
      setShowTagModal(false);
      message.success('标签已更新');
    },
    onError: (error: Error) => {
      message.error(error.message || '更新失败');
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: (input: {
      startTime: string;
      endTime: string;
      venueId: string;
      trainingContent?: string;
    }) => createPrivateLesson(privateStudentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-students', privateStudentId, 'lessons'] });
      queryClient.invalidateQueries({ queryKey: ['private-students', privateStudentId] });
      setShowCreateLessonModal(false);
      resetLessonForm();
      message.success('课程创建成功');
    },
    onError: (error: Error) => {
      message.error(error.message || '创建失败');
    },
  });

  const resetLessonForm = () => {
    setLessonStartTime('');
    setLessonEndTime('');
    setLessonVenue(null);
    setLessonTrainingContent('');
  };

  const handleCreateLesson = () => {
    if (!lessonVenue) {
      message.error('请选择球馆');
      return;
    }
    if (!lessonStartTime || !lessonEndTime) {
      message.error('请选择时间');
      return;
    }
    createLessonMutation.mutate({
      startTime: new Date(lessonStartTime).toISOString(),
      endTime: new Date(lessonEndTime).toISOString(),
      venueId: lessonVenue.id,
      trainingContent: lessonTrainingContent || undefined,
    });
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (trimmed.length > 20) {
      message.error('标签不能超过 20 个字符');
      return;
    }
    if (editingTags.length >= 10) {
      message.error('最多 10 个标签');
      return;
    }
    if (editingTags.includes(trimmed)) {
      message.error('标签已存在');
      return;
    }
    setEditingTags([...editingTags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setEditingTags(editingTags.filter((t) => t !== tag));
  };

  if (isUserLoading) return <div>加载中...</div>;
  if (currentUser && !currentUser.isCoach) {
    return (
      <CoachGuard onNavigateToSettings={() => navigate('/settings')} message="请先开启教练角色" />
    );
  }

  if (isDetailLoading) {
    return <div style={{ padding: 16, color: 'var(--text-3)', textAlign: 'center' }}>加载中...</div>;
  }

  if (!studentDetail) {
    return <div style={{ padding: 16, color: 'var(--text-3)', textAlign: 'center' }}>学员不存在</div>;
  }

  const lessons = lessonsData?.items ?? [];
  const notes = notesData?.items ?? [];
  const tags = tagsData?.tags ?? [];

  // Find the next upcoming lesson (scheduled, sorted by startTime ascending)
  const upcomingLesson = lessons
    .filter((l) => l.status === 'scheduled')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  // Completed/in-progress lessons for history (non-scheduled, non-cancelled)
  const historyLessons = lessons
    .filter((l) => l.status !== 'cancelled')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  return (
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <BackButton onClick={() => navigate('/my-private-students')} />
          {studentDetail.isActive && (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="btn-dark btn-danger btn-sm"
              data-testid="remove-student-btn"
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              移除
            </button>
          )}
        </div>

        {/* Student header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div
            className="avatar-grad-ring"
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              background: studentDetail.avatarUrl
                ? `url(${studentDetail.avatarUrl}) center/cover`
                : 'var(--surface-2)',
              color: 'var(--text-1)',
              flexShrink: 0,
            }}
          >
            {!studentDetail.avatarUrl && studentDetail.nickname.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{studentDetail.nickname}</div>
            {tags.length > 0 && (
              <div
                style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', cursor: 'pointer' }}
                onClick={() => {
                  setEditingTags([...tags]);
                  setShowTagModal(true);
                }}
              >
                {tags.map((tag) => (
                  <span key={tag} className="tag-green">{tag}</span>
                ))}
              </div>
            )}
            {tags.length === 0 && (
              <button
                onClick={() => {
                  setEditingTags([]);
                  setShowTagModal(true);
                }}
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                + 添加标签
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div
          className="dark-card"
          style={{ marginBottom: 12, padding: 8, cursor: 'default' }}
        >
          <div style={{ display: 'flex', textAlign: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                {studentDetail.lessonCount}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>已上课</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                {notes.length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>笔记</div>
            </div>
          </div>
        </div>

        {/* Upcoming lesson */}
        {upcomingLesson && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 8px' }}>下节课</div>
            <div
              className="dark-card"
              style={{ marginBottom: 12, cursor: 'pointer' }}
              onClick={() => navigate(`/my-private-students/${privateStudentId}/lessons/${upcomingLesson.id}`)}
              data-testid="upcoming-lesson"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  第{studentDetail.lessonCount + 1}节课
                </div>
                {lessonStatusBadge(upcomingLesson.status)}
              </div>
              <div className="info-row" style={{ marginTop: 6 }}>
                <span className="icon">📅</span>
                {new Date(upcomingLesson.startTime).toLocaleDateString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  weekday: 'short',
                })}{' '}
                {new Date(upcomingLesson.startTime).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                -
                {new Date(upcomingLesson.endTime).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              {upcomingLesson.venue && (
                <div className="info-row">
                  <span className="icon">📍</span>
                  {upcomingLesson.venue.name}
                </div>
              )}
              {upcomingLesson.trainingContent && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                  训练内容：{upcomingLesson.trainingContent}
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick actions */}
        {studentDetail.isActive && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              className="btn-dark btn-outline btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                resetLessonForm();
                setShowCreateLessonModal(true);
              }}
              data-testid="create-lesson-btn"
            >
              + 创建课程
            </button>
            <button
              className="btn-dark btn-outline btn-sm"
              style={{ flex: 1 }}
              onClick={() => setShowNoteModal(true)}
              data-testid="write-note-btn"
            >
              + 写笔记
            </button>
            <button
              className="btn-dark btn-outline btn-sm"
              style={{ flex: 1 }}
              onClick={() => navigate('/match-records/create')}
              data-testid="record-match-btn"
            >
              + 录入战绩
            </button>
          </div>
        )}

        {/* Recent notes */}
        {notes.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 8px' }}>最近笔记</div>
            {notes.slice(0, 3).map((note) => (
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
          </>
        )}

        {/* Lesson history */}
        <div style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 8px' }}>历史课程</div>
        {historyLessons.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '8px 0' }}>暂无课程</div>
        )}
        {historyLessons.map((lesson, index) => (
          <div
            key={lesson.id}
            className="dark-card"
            style={{ marginBottom: 8, cursor: 'pointer' }}
            onClick={() => navigate(`/my-private-students/${privateStudentId}/lessons/${lesson.id}`)}
            data-testid={`lesson-${lesson.id}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  第{historyLessons.length - index}节课
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {new Date(lesson.startTime).toLocaleDateString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short',
                  })}{' '}
                  {new Date(lesson.startTime).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  -
                  {new Date(lesson.endTime).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              {lessonStatusBadge(lesson.status)}
            </div>
          </div>
        ))}

        {/* Remove confirmation modal */}
        {showRemoveConfirm && (
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
              <p style={{ marginBottom: 16 }}>确定移除该私教学员？历史数据将保留。</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="btn-dark btn-sm"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
                >
                  取消
                </button>
                <button
                  onClick={() => removeMutation.mutate()}
                  className="btn-dark btn-sm"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                  data-testid="confirm-remove-btn"
                >
                  确认移除
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
              <h3 style={{ marginBottom: 12 }}>添加学员笔记</h3>
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

        {/* Tag management modal */}
        {showTagModal && (
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
              <h3 style={{ marginBottom: 12 }}>管理标签</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {editingTags.map((tag) => (
                  <span
                    key={tag}
                    className="chip chip-active chip-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {tag}
                    <span
                      onClick={() => handleRemoveTag(tag)}
                      style={{ cursor: 'pointer', fontSize: 14, marginLeft: 2 }}
                    >
                      x
                    </span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="输入标签（回车添加）"
                  maxLength={20}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'var(--surface)',
                    border: '1.5px solid var(--surface-2)',
                    borderRadius: 8,
                    color: 'var(--text-1)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button onClick={handleAddTag} className="btn-dark btn-primary btn-sm">
                  添加
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  onClick={() => setShowTagModal(false)}
                  className="btn-dark btn-sm"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
                >
                  取消
                </button>
                <button
                  onClick={() => setTagsMutation.mutate(editingTags)}
                  disabled={setTagsMutation.isPending}
                  className="btn-dark btn-primary btn-sm"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create lesson modal */}
        {showCreateLessonModal && (
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
                maxHeight: '85vh',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <h3 style={{ marginBottom: 12 }}>创建私教课程</h3>
              <div style={{ marginBottom: 12 }}>
                <label>球馆</label>
                <VenueSearchInput
                  selectedVenue={lessonVenue}
                  onChangeSelection={(venue) => setLessonVenue(venue)}
                  placeholder="搜索球馆"
                  helperText="输入球馆名称后，从搜索结果中选择"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <DateTimePicker
                  label="开始时间"
                  value={lessonStartTime || undefined}
                  onChange={(iso) => setLessonStartTime(iso)}
                  placeholder="选择开始时间"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <DateTimePicker
                  label="结束时间"
                  value={lessonEndTime || undefined}
                  onChange={(iso) => setLessonEndTime(iso)}
                  placeholder="选择结束时间"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label>训练内容（选填）</label>
                <textarea
                  value={lessonTrainingContent}
                  onChange={(e) => setLessonTrainingContent(e.target.value)}
                  placeholder="输入训练内容"
                  maxLength={2000}
                  rows={3}
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
                    marginTop: 4,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowCreateLessonModal(false);
                    resetLessonForm();
                  }}
                  className="btn-dark btn-sm"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateLesson}
                  disabled={createLessonMutation.isPending}
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
