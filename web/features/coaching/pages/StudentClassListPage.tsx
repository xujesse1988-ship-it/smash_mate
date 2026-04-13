import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { CoachGuard } from '../../../shared/components/CoachGuard';
import { DarkCard } from '../../../shared/components/DarkCard';
import { useStudentClasses } from '../hooks/useStudentClasses';
import { useCreateStudentClass } from '../hooks/useCreateStudentClass';
import { useDeleteStudentClass } from '../hooks/useDeleteStudentClass';

export function StudentClassListPage() {
  const navigate = useNavigate();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const { data: classesData, isLoading: isClassesLoading } = useStudentClasses();
  const createMutation = useCreateStudentClass();
  const deleteMutation = useDeleteStudentClass();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  if (isUserLoading) return <div>加载中...</div>;
  if (currentUser && !currentUser.isCoach) {
    return (
      <CoachGuard
        onNavigateToSettings={() => navigate('/settings')}
        message="请先开启教练角色"
      />
    );
  }

  const classes = classesData?.items ?? [];

  const handleCreate = () => {
    if (!newClassName.trim()) return;
    createMutation.mutate(
      { name: newClassName.trim() },
      {
        onSuccess: () => {
          setShowCreateModal(false);
          setNewClassName('');
        },
      },
    );
  };

  const handleDelete = () => {
    if (deletingClassId) {
      deleteMutation.mutate(deletingClassId, {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          setDeletingClassId(null);
        },
      });
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>我的学员班</h2>
      </div>

      {isClassesLoading ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)' }}>加载中...</div>
      ) : classes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)' }}>暂无学员班</div>
      ) : (
        classes.map((cls) => (
          <DarkCard
            key={cls.id}
            onClick={() => navigate(`/my-student-classes/${cls.id}`)}
            style={{ marginBottom: 12, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{cls.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
                  {cls.memberCount} 名学员 | {cls.lessonCount} 节课程
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingClassId(cls.id);
                  setShowDeleteConfirm(true);
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
                删除
              </button>
            </div>
          </DarkCard>
        ))
      )}

      {/* FAB Create Button */}
      <button
        onClick={() => {
          setNewClassName('');
          setShowCreateModal(true);
        }}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--primary)',
          color: '#052e16',
          border: 'none',
          fontSize: 28,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(74,222,128,.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="创建学员班"
      >
        +
      </button>

      {/* Create Modal */}
      {showCreateModal && (
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
            <h3 style={{ margin: '0 0 16px' }}>创建学员班</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-2)' }}>班级名称</label>
              <input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="输入班级名称（2-30字）"
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
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '6px 16px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 6,
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                style={{
                  padding: '6px 16px',
                  background: 'var(--primary)',
                  color: '#052e16',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
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
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              width: '80%',
              maxWidth: 360,
            }}
          >
            <p>确认删除该学员班？删除后所有学员和课程数据将被清除，已录入的战绩不受影响。</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingClassId(null);
                }}
                style={{
                  padding: '6px 16px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 6,
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                }}
              >
                返回
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '6px 16px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
