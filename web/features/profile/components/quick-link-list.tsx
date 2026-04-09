import React from 'react';
import {
  CalendarOutlined,
  ReadOutlined,
  SettingOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { QuickLinkItem } from './quick-link-item';

interface QuickLinkListProps {
  userId: string;
  isCoach: boolean;
  navigate: (path: string) => void;
}

export function QuickLinkList({ userId, isCoach, navigate }: QuickLinkListProps) {
  const items = [
    {
      label: '我的活动',
      icon: <CalendarOutlined />,
      onClick: () => navigate('/my-activities'),
    },
    ...(isCoach
      ? [
          {
            label: '我的报名',
            icon: <ReadOutlined />,
            onClick: () => navigate('/my-enrollments'),
          },
          {
            label: '课程管理',
            icon: <ReadOutlined />,
            onClick: () => navigate('/my-courses'),
          },
          {
            label: '教练资料',
            icon: <TeamOutlined />,
            onClick: () => navigate('/profile/coach-edit'),
          },
        ]
      : [
          {
            label: '我的课程',
            icon: <ReadOutlined />,
            onClick: () => navigate('/my-enrollments'),
          },
        ]),
    {
      label: '战绩记录',
      icon: <TrophyOutlined />,
      onClick: () => navigate(`/users/${userId}/match-records`),
    },
    {
      label: '个人资料',
      icon: <UserOutlined />,
      onClick: () => navigate('/profile/edit'),
    },
    {
      label: '设置',
      icon: <SettingOutlined />,
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div
      style={{
        marginTop: 16,
        padding: '0 16px',
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 16,
      }}
    >
      {items.map((item, index) => (
        <QuickLinkItem
          key={item.label}
          label={item.label}
          icon={item.icon}
          onClick={item.onClick}
          showDivider={index < items.length - 1}
        />
      ))}
    </div>
  );
}
