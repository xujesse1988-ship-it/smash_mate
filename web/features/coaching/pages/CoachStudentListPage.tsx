import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useAuthStore } from '../../../stores/auth-store';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { CoachGuard } from '../../../shared/components/CoachGuard';
import { BackButton } from '../../../shared/components/BackButton';
import {
  getCoachStudents,
  addCoachStudent,
  searchStudentByPhone,
} from '../api/coach-student-api';
import type { CoachStudentListItem, StudentSearchResult } from '../api/coach-student-api';

export function CoachStudentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const [showAddModal, setShowAddModal] = useState(false);
  const [phoneKeyword, setPhoneKeyword] = useState('');
  const [searchResult, setSearchResult] = useState<StudentSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filter state
  const [filterTag, setFilterTag] = useState('');
  const [searchText, setSearchText] = useState('');

  const { data: studentsData, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['coach-students', filterTag, searchText],
    queryFn: () =>
      getCoachStudents({
        tag: filterTag || undefined,
        search: searchText || undefined,
      }),
    enabled: !!userId,
  });

  // Collect all unique tags for the filter
  const allTags = useMemo(() => {
    const students = studentsData?.items ?? [];
    const tagSet = new Set<string>();
    students.forEach((s) => s.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [studentsData]);

  const addStudentMutation = useMutation({
    mutationFn: (studentId: string) => addCoachStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-students'] });
      setShowAddModal(false);
      setPhoneKeyword('');
      setSearchResult(null);
      setHasSearched(false);
      message.success('添加成功');
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === 'COACH_STUDENT_ALREADY_EXISTS') {
        message.info('该用户已是你的学员');
      } else if (error.code === 'USER_NOT_FOUND') {
        message.error('用户不存在');
      } else {
        message.error(error.message || '添加失败');
      }
    },
  });

  const handlePhoneSearch = async () => {
    if (!phoneKeyword.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const result = await searchStudentByPhone(phoneKeyword.trim());
      setSearchResult(result);
    } catch {
      setSearchResult(null);
      message.error('未找到该手机号对应的用户');
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
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Header with back button */}
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
        <BackButton onClick={() => navigate(`/users/${userId}`)} style={{ marginRight: 8 }} />
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-1)' }}>
          我的学员
        </h2>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
          {/* Search bar */}
          <div style={{ marginBottom: 12 }}>
            <input
              data-testid="coach-student-search-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索学员昵称"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1.5px solid var(--surface-2)',
                borderRadius: 10,
                color: 'var(--text-1)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div
              data-testid="coach-student-tag-filter"
              style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}
            >
              <button
                className={`btn-dark btn-sm ${!filterTag ? 'btn-primary' : ''}`}
                style={{
                  fontSize: 12,
                  background: !filterTag ? undefined : 'var(--surface-2)',
                  color: 'var(--text-1)',
                }}
                onClick={() => setFilterTag('')}
              >
                全部
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={`btn-dark btn-sm ${filterTag === tag ? 'btn-primary' : ''}`}
                  style={{
                    fontSize: 12,
                    background: filterTag === tag ? undefined : 'var(--surface-2)',
                    color: 'var(--text-1)',
                  }}
                  onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {isStudentsLoading && (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
              加载中...
            </div>
          )}

          {!isStudentsLoading && students.length === 0 && (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
              暂无学员
            </div>
          )}

          {students.map((student) => (
            <CoachStudentCard
              key={student.studentId}
              student={student}
              onClick={() => navigate(`/my-students/${student.studentId}`)}
            />
          ))}

          {/* FAB */}
          <button
            className="fab"
            data-testid="coach-student-add-fab"
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
                <h3 style={{ marginBottom: 16 }}>添加学员</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    data-testid="coach-student-phone-input"
                    value={phoneKeyword}
                    onChange={(e) => setPhoneKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePhoneSearch()}
                    placeholder="输入手机号搜索"
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
                    data-testid="coach-student-phone-search-btn"
                    onClick={handlePhoneSearch}
                    disabled={isSearching}
                    className="btn-dark btn-primary btn-sm"
                  >
                    搜索
                  </button>
                </div>

                {isSearching && (
                  <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>
                    搜索中...
                  </div>
                )}

                {!isSearching && hasSearched && !searchResult && (
                  <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>
                    未找到匹配的用户
                  </div>
                )}

                {searchResult && (
                  <div
                    data-testid="coach-student-search-result"
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
                          background: 'var(--surface-2)',
                          color: 'var(--text-1)',
                        }}
                      >
                        {searchResult.nickname.charAt(0)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          {searchResult.nickname}
                        </span>
                        {searchResult.phoneLast4 && (
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            尾号 {searchResult.phoneLast4}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      data-testid="coach-student-add-btn"
                      onClick={() => addStudentMutation.mutate(searchResult.userId)}
                      disabled={addStudentMutation.isPending}
                      className="btn-dark btn-primary btn-sm"
                      style={{ fontSize: 12 }}
                    >
                      添加
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setPhoneKeyword('');
                      setSearchResult(null);
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student Card Sub-component
// ---------------------------------------------------------------------------

function CoachStudentCard({
  student,
  onClick,
}: {
  student: CoachStudentListItem;
  onClick: () => void;
}) {
  const tags = student.tags;
  const sourceLabel =
    student.source === 'manual'
      ? '手动添加'
      : student.source === 'private_lesson'
        ? '私教课'
        : student.source === 'group_class'
          ? '团课'
          : student.source;

  return (
    <div
      className="dark-card"
      data-testid={`coach-student-${student.studentId}`}
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
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{student.nickname}</div>
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
            来源: {sourceLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
