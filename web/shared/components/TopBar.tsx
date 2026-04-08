import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useUnreadCount } from '../hooks/useUnreadCount';

/**
 * Global top bar shown in AppLayout.
 * Displays a page title and a notification bell icon with an unread-count badge.
 *
 * Design reference: docs/module-design/web-app.md §5 — TopBar
 */
interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fff',
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 600 }}>{title}</span>
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <BellOutlined
          style={{ fontSize: 20, cursor: 'pointer' }}
          onClick={() => navigate('/notifications')}
          aria-label="通知"
        />
      </Badge>
    </div>
  );
}
