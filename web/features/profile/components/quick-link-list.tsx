import React from 'react';
import { QuickLinkItem } from './quick-link-item';

interface QuickLinkListProps {
  userId: string;
  isCoach: boolean;
  navigate: (path: string) => void;
}

export function QuickLinkList({ userId, isCoach, navigate }: QuickLinkListProps) {
  return (
    <div>
      <QuickLinkItem label="我发起的活动" onClick={() => navigate('/my-activities?role=initiated')} />
      <QuickLinkItem label="我参加的活动" onClick={() => navigate('/my-activities?role=participated')} />

      {isCoach ? (
        <>
          <QuickLinkItem label="我的报名" onClick={() => navigate('/my-enrollments')} />
          <QuickLinkItem label="课程管理" onClick={() => navigate('/my-courses')} />
        </>
      ) : (
        <QuickLinkItem label="我的课程" onClick={() => navigate('/my-enrollments')} />
      )}

      <QuickLinkItem label="战绩记录" onClick={() => navigate(`/users/${userId}/match-records`)} />
      <QuickLinkItem label="个人资料" onClick={() => navigate('/profile/edit')} />
      <QuickLinkItem label="设置" onClick={() => navigate('/settings')} />
    </div>
  );
}
