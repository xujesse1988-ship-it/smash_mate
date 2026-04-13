import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BackButton } from '../../../shared/components/BackButton';
import { DarkCard } from '../../../shared/components/DarkCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { DateTimePicker } from '../../../shared/components/DateTimePicker';
import { VenueSearchInput } from '../../activity/components/venue-search-input';
import type { VenueSearchItem } from '../../activity/api/venue-api';
import { useStudentClassDetail } from '../hooks/useStudentClassDetail';
import { useClassLessons } from '../hooks/useClassLessons';
import { useUpdateStudentClass } from '../hooks/useUpdateStudentClass';
import { useAddStudentToClass } from '../hooks/useAddStudentToClass';
import { useRemoveStudentFromClass } from '../hooks/useRemoveStudentFromClass';
import { useCreateClassLesson } from '../hooks/useCreateClassLesson';
import { searchUsers } from '../api/student-class-api';
import type { UserSearchResult } from '../api/student-class-api';

const statusMap: Record<string, { label: string; variant: 'green' | 'blue' | 'gray' | 'red' }> = {
  scheduled: { label: '未开始', variant: 'blue' },
  in_progress: { label: '进行中', variant: 'green' },
  completed: { label: '已结束', variant: 'gray' },
  cancelled: { label: '已取消', variant: 'red' },
};

export function StudentClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const { data: classDetail, isLoading: isDetailLoading } = useStudentClassDetail(classId || '');
  const { data: lessonsData, isLoading: isLessonsLoading } = useClassLessons(classId || '');
  const updateClassMutation = useUpdateStudentClass();
  const addStudentMutation = useAddStudentToClass();
  const removeStudentMutation = useRemoveStudentFromClass();
  const createLessonMutation = useCreateClassLesson();

  const [activeTab, setActiveTab] = useState<'students' | 'lessons'>('students');

  // Edit class name
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editName, setEditName] = useState('');

  // Add student
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Create lesson
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);
  const [lessonStartTime, setLessonStartTime] = useState('');
  const [lessonEndTime, setLessonEndTime] = useState('');
  const [lessonVenue, setLessonVenue] = useState<VenueSearchItem | null>(null);
  const [lessonTrainingContent, setLessonTrainingContent] = useState('');

  // Remove student confirm
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

  if (isDetailLoading) return <div style={{ padding: 16 }}>加载中...</div>;
  if (!classDetail) return <div style={{ padding: 16 }}>学员班不存在</div>;

  const members = classDetail.members ?? [];
  const lessons = lessonsData?.items ?? [];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const result = await searchUsers(searchQuery.trim());
      setSearchResults(result.items);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddStudent = (studentId: string) => {
    if (!classId) return;
    addStudentMutation.mutate(
      { classId, studentId },
      {
        onSuccess: () => {
          setShowAddStudentModal(false);
          setSearchQuery('');
          setSearchResults([]);
        },
      },
    );
  };

  const handleRemoveStudent = () => {
    if (!classId || !removingStudentId) return;
    removeStudentMutation.mutate(
      { classId, studentId: removingStudentId },
      {
        onSuccess: () => {
          setShowRemoveConfirm(false);
          setRemovingStudentId(null);
        },
      },
    );
  };

  const handleUpdateName = () => {
    if (!classId || !editName.trim()) return;
    updateClassMutation.mutate(
      { classId, name: editName.trim() },
      {
        onSuccess: () => {
          setShowEditNameModal(false);
        },
      },
    );
  };

  const handleCreateLesson = () => {
    if (!classId || !lessonVenue || !lessonStartTime || !lessonEndTime) return;
    createLessonMutation.mutate(
      {
        classId,
        data: {
          startTime: lessonStartTime,
          endTime: lessonEndTime,
          venueId: lessonVenue.id,
          trainingContent: lessonTrainingContent || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowCreateLessonModal(false);
          setLessonStartTime('');
          setLessonEndTime('');
          setLessonVenue(null);
          setLessonTrainingContent('');
        },
      },
    );
  };

  return (
    <div style={{ padding: 16 }}>
      <BackButton onClick={() => navigate('/my-student-classes')} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>{classDetail.name}</h2>
        <button
          onClick={() => {
            setEditName(classDetail.name);
            setShowEditNameModal(true);
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
          编辑名称
        </button>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
        {classDetail.memberCount} 名学员 | {classDetail.lessonCount} 节课程
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-2)', marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('students')}
          style={{
            flex: 1,
            padding: 8,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'students' ? '2px solid var(--primary)' : '2px solid transparent',
            fontWeight: activeTab === 'students' ? 600 : 400,
            color: activeTab === 'students' ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          学员
        </button>
        <button
          onClick={() => setActiveTab('lessons')}
          style={{
            flex: 1,
            padding: 8,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'lessons' ? '2px solid var(--primary)' : '2px solid transparent',
            fontWeight: activeTab === 'lessons' ? 600 : 400,
            color: activeTab === 'lessons' ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          课程
        </button>
      </div>

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div>
          <button
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
              setShowAddStudentModal(true);
            }}
            style={{
              marginBottom: 16,
              padding: '8px 16px',
              background: 'var(--primary)',
              color: '#052e16',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            添加学员
          </button>

          {members.length === 0 ? (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>暂无学员</div>
          ) : (
            members.map((member) => (
              <DarkCard key={member.studentId} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--surface-2)',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {member.avatarUrl && (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  <div
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => navigate(`/my-student-classes/${classId}/members/${member.studentId}`)}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{member.nickname}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {new Date(member.joinedAt).toLocaleDateString()} 加入
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setRemovingStudentId(member.studentId);
                      setShowRemoveConfirm(true);
                    }}
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
                    移除
                  </button>
                </div>
              </DarkCard>
            ))
          )}
        </div>
      )}

      {/* Lessons Tab */}
      {activeTab === 'lessons' && (
        <div>
          <button
            onClick={() => {
              setLessonStartTime('');
              setLessonEndTime('');
              setLessonVenue(null);
              setLessonTrainingContent('');
              setShowCreateLessonModal(true);
            }}
            style={{
              marginBottom: 16,
              padding: '8px 16px',
              background: 'var(--primary)',
              color: '#052e16',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            创建课程
          </button>

          {isLessonsLoading ? (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>加载中...</div>
          ) : lessons.length === 0 ? (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>暂无课程</div>
          ) : (
            lessons.map((lesson) => {
              const statusInfo = statusMap[lesson.status] || { label: lesson.status, variant: 'gray' as const };
              return (
                <DarkCard
                  key={lesson.id}
                  onClick={() => navigate(`/my-student-classes/${classId}/lessons/${lesson.id}`)}
                  style={{ marginBottom: 8, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {new Date(lesson.startTime).toLocaleDateString()}{' '}
                        {new Date(lesson.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(lesson.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                        {lesson.venue?.name || '地点待定'}
                      </div>
                      {lesson.trainingContent && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                          {lesson.trainingContent.length > 30
                            ? lesson.trainingContent.slice(0, 30) + '...'
                            : lesson.trainingContent}
                        </div>
                      )}
                    </div>
                    <StatusBadge variant={statusInfo.variant}>{statusInfo.label}</StatusBadge>
                  </div>
                </DarkCard>
              );
            })
          )}
        </div>
      )}

      {/* Edit Name Modal */}
      {showEditNameModal && (
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
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '90%', maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px' }}>编辑班级名称</h3>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="输入班级名称（2-30字）"
              style={{
                width: '100%',
                padding: 10,
                boxSizing: 'border-box',
                border: '1px solid var(--surface-2)',
                borderRadius: 8,
                background: 'var(--surface-2)',
                color: 'var(--text-1)',
                fontSize: 14,
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEditNameModal(false)}
                style={{ padding: '6px 16px', border: '1px solid var(--surface-2)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-1)', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleUpdateName}
                disabled={updateClassMutation.isPending}
                style={{ padding: '6px 16px', background: 'var(--primary)', color: '#052e16', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
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
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '90%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px' }}>添加学员</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索昵称或手机号"
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
                onClick={handleSearch}
                disabled={isSearching}
                style={{ padding: '8px 16px', background: 'var(--primary)', color: '#052e16', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                搜索
              </button>
            </div>

            {isSearching && <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 12 }}>搜索中...</div>}

            {searchResults.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--surface-2)',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {user.avatarUrl && (
                    <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{user.nickname}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>****{user.phoneLast4}</div>
                </div>
                <button
                  onClick={() => handleAddStudent(user.id)}
                  disabled={addStudentMutation.isPending}
                  style={{
                    fontSize: 12,
                    padding: '4px 12px',
                    background: 'var(--primary)',
                    color: '#052e16',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  添加
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setShowAddStudentModal(false)}
                style={{ padding: '6px 16px', border: '1px solid var(--surface-2)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-1)', cursor: 'pointer' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Confirm */}
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
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '80%', maxWidth: 360 }}>
            <p>确认移除该学员？</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowRemoveConfirm(false); setRemovingStudentId(null); }}
                style={{ padding: '6px 16px', border: '1px solid var(--surface-2)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-1)', cursor: 'pointer' }}
              >
                返回
              </button>
              <button
                onClick={handleRemoveStudent}
                style={{ padding: '6px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Lesson Modal */}
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
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '90%', maxWidth: 400, maxHeight: '85vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <h3 style={{ margin: '0 0 16px' }}>创建课程</h3>
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
              <label style={{ fontSize: 13, color: 'var(--text-2)' }}>球馆</label>
              <VenueSearchInput
                selectedVenue={lessonVenue}
                onChangeSelection={(venue) => setLessonVenue(venue)}
                placeholder="搜索球馆"
                helperText="输入球馆名称后，从搜索结果中选择"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-2)' }}>训练内容（选填）</label>
              <textarea
                value={lessonTrainingContent}
                onChange={(e) => setLessonTrainingContent(e.target.value)}
                placeholder="填写训练内容"
                rows={3}
                style={{
                  width: '100%',
                  padding: 10,
                  marginTop: 4,
                  boxSizing: 'border-box',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateLessonModal(false)}
                style={{ padding: '6px 16px', border: '1px solid var(--surface-2)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-1)', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleCreateLesson}
                disabled={createLessonMutation.isPending}
                style={{ padding: '6px 16px', background: 'var(--primary)', color: '#052e16', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
