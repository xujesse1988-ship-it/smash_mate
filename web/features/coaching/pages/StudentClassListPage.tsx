import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { CoachGuard } from '../../../shared/components/CoachGuard';
import { StudentClassListView } from '../components/StudentClassListView';

/**
 * 独立的学员班列表页：保留路由 `/my-student-classes` 作为详情子页 BackButton 的回跳目标。
 * 主要入口已并入 `/my-courses` 的"学员班" Tab。
 */
export function StudentClassListPage() {
  const navigate = useNavigate();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  if (isUserLoading) return <div>加载中...</div>;
  if (currentUser && !currentUser.isCoach) {
    return (
      <CoachGuard onNavigateToSettings={() => navigate('/settings')} message="请先开启教练角色" />
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <StudentClassListView showHeader />
    </div>
  );
}
