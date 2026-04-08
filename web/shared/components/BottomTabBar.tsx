import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarOutlined,
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

  const tabs: TabItem[] = [
    { key: 'activities', label: '约球', icon: <CalendarOutlined />, path: '/activities' },
    { key: 'coaches', label: '找教练', icon: <TeamOutlined />, path: '/coaches' },
    { key: 'profile', label: '我的', icon: <UserOutlined />, path: `/users/${userId}` },
  ];

  function getActiveKey(): string {
    if (location.pathname === '/activities') return 'activities';
    if (location.pathname === '/coaches') return 'coaches';
    if (location.pathname === `/users/${userId}`) return 'profile';
    return '';
  }

  const activeKey = getActiveKey();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderTop: '1px solid #f0f0f0',
        background: '#fff',
        padding: '6px 0',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              color: isActive ? '#00C853' : '#999',
              fontSize: 12,
              flex: 1,
            }}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
}
