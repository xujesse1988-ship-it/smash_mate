import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useAuthStore } from '../../../stores/auth-store';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { CoachGuard } from '../../../shared/components/CoachGuard';
import { BackButton } from '../../../shared/components/BackButton';
import {
  getPrivateStudents,
  addPrivateStudent,
  getPrivateStudentTags,
} from '../api/private-student-api';
import type { PrivateStudentListItem } from '../api/private-student-api';
import { searchUsers } from '../api/student-class-api';
import type { UserSearchResult } from '../api/student-class-api';

export function PrivateStudentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { data: studentsData, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['private-students'],
    queryFn: getPrivateStudents,
    enabled: !!userId,
  });

  const addStudentMutation = useMutation({
    mutationFn: (studentId: string) => addPrivateStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-students'] });
      setShowAddModal(false);
      setSearchKeyword('');
      setSearchResults([]);
      setHasSearched(false);
      message.success('添加成功');
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === 'COACHING_STUDENT_ALREADY_PRIVATE') {
        message.error('该学员已是你的固定私教学员');
      } else if (error.code === 'USER_NOT_FOUND') {
        message.error('用户不存在');
      } else {
        message.error(error.message || '添加失败');
      }
    },
  });

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const result = await searchUsers(searchKeyword.trim());
      setSearchResults(result.items);
    } catch {
      setSearchResults([]);
      message.error('搜索失败');
    } finally {
      setIsSearching(false);
    }
  };

  if (isUserLoading) return <div>加载中...</div>;
  if (currentUser && !currentUser.isCoach) {
    return (
      <CoachGuard onNavigateToSettings={() => navigate('/settings')} message="请先开启教练角色" />
    );
  }

  const students = studentsData?.items ?? [];

  return (
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <BackButton onClick={() => navigate(-1)} style={{ marginBottom: 12, padding: '6px 0' }} />

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--text-1)' }}>
          我的私教学员
        </h2>

        {isStudentsLoading && <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>加载中...</div>}

        {!isStudentsLoading && students.length === 0 && (
          <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
            暂无私教学员
          </div>
        )}

        {students.map((student) => (
          <PrivateStudentCard
            key={student.id}
            student={student}
            onClick={() => navigate(`/my-private-students/${student.id}`)}
          />
        ))}

        {/* FAB */}
        <button
          className="fab"
          data-testid="add-private-student-fab"
          onClick={() => setShowAddModal(true)}
        >
          +
        </button>

        {/* Add Student Modal */}
        {showAddModal && (
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
              }}
            >
              <h3 style={{ marginBottom: 16 }}>添加私教学员</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="输入昵称、手机号或手机号后 4 位"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'var(--surface)',
                    border: '1.5px solid var(--surface-2)',
                    borderRadius: 10,
                    color: 'var(--text-1)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="btn-dark btn-primary btn-sm"
                >
                  搜索
                </button>
              </div>

              {isSearching && (
                <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>搜索中...</div>
              )}

              {!isSearching && hasSearched && searchResults.length === 0 && (
                <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>
                  未找到匹配的用户
                </div>
              )}

              {searchResults.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--surface-2)',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      className="avatar-grad-ring"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        background: user.avatarUrl ? `url(${user.avatarUrl}) center/cover` : 'var(--surface-2)',
                        color: 'var(--text-1)',
                      }}
                    >
                      {!user.avatarUrl && user.nickname.charAt(0)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{user.nickname}</span>
                      {user.phoneLast4 && (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          尾号 {user.phoneLast4}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => addStudentMutation.mutate(user.id)}
                    disabled={addStudentMutation.isPending}
                    className="btn-dark btn-primary btn-sm"
                    style={{ fontSize: 12 }}
                  >
                    添加
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSearchKeyword('');
                    setSearchResults([]);
                    setHasSearched(false);
                  }}
                  className="btn-dark btn-sm"
                  style={{
                    background: 'var(--surface-2)',
                    color: 'var(--text-1)',
                  }}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student Card Sub-component
// ---------------------------------------------------------------------------

function PrivateStudentCard({
  student,
  onClick,
}: {
  student: PrivateStudentListItem;
  onClick: () => void;
}) {
  // Fetch tags for display
  const { data: tagsData } = useQuery({
    queryKey: ['private-students', student.id, 'tags'],
    queryFn: () => getPrivateStudentTags(student.id),
  });

  const tags = tagsData?.tags ?? [];

  return (
    <div
      className="dark-card"
      data-testid={`private-student-${student.id}`}
      onClick={onClick}
      style={{ marginBottom: 10, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          className="avatar-grad-ring"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            background: student.avatarUrl
              ? `url(${student.avatarUrl}) center/cover`
              : 'var(--surface-2)',
            color: 'var(--text-1)',
            flexShrink: 0,
          }}
        >
          {!student.avatarUrl && student.nickname.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
            {student.nickname}
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {tags.map((tag) => (
                <span key={tag} className="tag-green" style={{ fontSize: 11 }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            已上 {student.lessonCount} 节课
          </div>
        </div>
      </div>
    </div>
  );
}
