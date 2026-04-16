import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarOutlined,
  ReadOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/auth-store';

/**
 * Bottom navigation bar displayed on the three main pages:
 *   /activities, /coaches, /users/:id (current user's profile)
 *
 * Design reference: docs/module-design/web-app.md §5 — BottomTabBar
 */

interface TabItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = useAuthStore((state) => state.userId);
  const coachMode = useAuthStore((state) => state.coachMode);

  const tabs: TabItem[] = coachMode
    ? [
        { key: 'courses', label: '课程', icon: <ReadOutlined />, path: '/my-courses' },
        { key: 'students', label: '学员', icon: <TeamOutlined />, path: '/my-students' },
        { key: 'profile', label: '我的', icon: <UserOutlined />, path: `/users/${userId}` },
      ]
    : [
        { key: 'activities', label: '约球', icon: <CalendarOutlined />, path: '/activities' },
        { key: 'coaches', label: '找教练', icon: <TeamOutlined />, path: '/coaches' },
        { key: 'profile', label: '我的', icon: <UserOutlined />, path: `/users/${userId}` },
      ];

  function getActiveKey(): string {
    if (coachMode) {
      if (location.pathname === '/my-courses') return 'courses';
      if (location.pathname === '/my-students') return 'students';
    } else {
      if (location.pathname === '/activities') return 'activities';
      if (location.pathname === '/coaches') return 'coaches';
    }
    if (location.pathname === `/users/${userId}`) return 'profile';
    return '';
  }

  const activeKey = getActiveKey();

  return (
    <div
      style={{
        display: 'flex',
        background: 'rgba(15,23,42,.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--surface-2)',
        padding: '6px 0 8px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              color: isActive ? 'var(--primary)' : 'var(--text-3)',
              fontSize: 11,
              fontWeight: 500,
              padding: '4px 0',
              transition: 'var(--transition)',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--primary)',
                marginTop: 2,
                opacity: isActive ? 1 : 0,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
