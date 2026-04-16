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
  getCoachStudentDetail,
  getCoachStudentLessons,
  setCoachStudentTags,
  scheduleLessonForStudent,
} from '../api/coach-student-api';
// Types CoachStudentDetail and CoachStudentLesson are inferred from the API functions above

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

export function CoachStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const [showTagModal, setShowTagModal] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);
  const [lessonStartTime, setLessonStartTime] = useState('');
  const [lessonEndTime, setLessonEndTime] = useState('');
  const [lessonVenue, setLessonVenue] = useState<VenueSearchItem | null>(null);
  const [lessonTrainingContent, setLessonTrainingContent] = useState('');

  const sid = studentId || '';

  const { data: studentDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['coach-students', sid],
    queryFn: () => getCoachStudentDetail(sid),
    enabled: !!sid,
  });

  const { data: lessonsData } = useQuery({
    queryKey: ['coach-students', sid, 'lessons'],
    queryFn: () => getCoachStudentLessons(sid),
    enabled: !!sid,
  });

  const setTagsMutation = useMutation({
    mutationFn: (tags: string[]) => setCoachStudentTags(sid, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-students', sid] });
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
      venueId?: string;
      trainingContent?: string;
    }) => scheduleLessonForStudent(sid, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-students', sid, 'lessons'] });
      queryClient.invalidateQueries({ queryKey: ['coach-students', sid] });
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
    if (!lessonStartTime || !lessonEndTime) {
      message.error('请选择时间');
      return;
    }
    createLessonMutation.mutate({
      startTime: new Date(lessonStartTime).toISOString(),
      endTime: new Date(lessonEndTime).toISOString(),
      venueId: lessonVenue?.id || undefined,
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
  const tags = studentDetail.tags ?? [];

  // Find the next upcoming lesson (scheduled, sorted by startTime ascending)
  const upcomingLesson = lessons
    .filter((l) => l.status === 'scheduled')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  // All non-cancelled lessons for history, sorted by startTime descending
  const historyLessons = lessons
    .filter((l) => l.status !== 'cancelled')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Header with back button — consistent with MyActivityListPage */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid var(--surface-2)',
          background: 'rgba(15,23,42,.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <BackButton onClick={() => navigate('/my-students')} style={{ marginRight: 8 }} />
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-1)' }}>
          {studentDetail?.nickname ?? '学员详情'}
        </h2>
      </div>

      <div style={{ padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        {/* Student header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div
            className="avatar-grad-ring"
            data-testid="coach-student-avatar"
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
            <div style={{ fontSize: 17, fontWeight: 700 }} data-testid="coach-student-nickname">
              {studentDetail.nickname}
            </div>
            {tags.length > 0 && (
              <div
                style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', cursor: 'pointer' }}
                onClick={() => {
                  setEditingTags([...tags]);
                  setShowTagModal(true);
                }}
                data-testid="coach-student-tags"
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
                data-testid="coach-student-add-tag-btn"
              >
                + 添加标签
              </button>
            )}
          </div>
        </div>

        {/* Source info */}
        <div
          className="dark-card"
          style={{ marginBottom: 12, padding: 8, cursor: 'default' }}
          data-testid="coach-student-info"
        >
          <div style={{ display: 'flex', textAlign: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>来源</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginTop: 2 }}>
                {studentDetail.source === 'manual' ? '手动添加' :
                 studentDetail.source === 'private_lesson' || studentDetail.source === 'private-lesson' ? '私教课' :
                 studentDetail.source === 'group_class' || studentDetail.source === 'group-class' ? '团课' :
                 studentDetail.source === 'class_lesson' || studentDetail.source === 'class-lesson' ? '学员班' :
                 studentDetail.source}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>首次接触</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginTop: 2 }}>
                {new Date(studentDetail.firstMetAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Student classes */}
        {studentDetail.studentClasses && studentDetail.studentClasses.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 8px' }}>所属学员班</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }} data-testid="coach-student-classes">
              {studentDetail.studentClasses.map((cls) => (
                <span
                  key={cls.id}
                  className="chip chip-active chip-sm"
                  style={{ cursor: 'default' }}
                >
                  {cls.name}
                </span>
              ))}
            </div>
          </>
        )}

        {/* Upcoming lesson */}
        {upcomingLesson && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 8px' }}>下节课</div>
            <div
              className="dark-card"
              style={{ marginBottom: 12, cursor: 'pointer' }}
              onClick={() => navigate(`/my-students/${sid}/lessons/${upcomingLesson.id}`)}
              data-testid="coach-student-upcoming-lesson"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  下节课
                </div>
                {lessonStatusBadge(upcomingLesson.status)}
              </div>
              <div className="info-row" style={{ marginTop: 6 }}>
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            className="btn-dark btn-outline btn-sm"
            style={{ flex: 1 }}
            onClick={() => {
              resetLessonForm();
              setShowCreateLessonModal(true);
            }}
            data-testid="coach-student-create-lesson-btn"
          >
            + 给 TA 排课
          </button>
        </div>

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
            onClick={() => navigate(`/my-students/${sid}/lessons/${lesson.id}`)}
            data-testid={`coach-student-lesson-${lesson.id}`}
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
                  data-testid="coach-student-tag-input"
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
                  data-testid="coach-student-save-tags-btn"
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
              <h3 style={{ marginBottom: 12 }}>给 TA 排课</h3>
              <div style={{ marginBottom: 12 }}>
                <label>球馆（选填）</label>
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
                  data-testid="coach-student-training-content"
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
                  data-testid="coach-student-submit-lesson-btn"
                >
                  提交
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
