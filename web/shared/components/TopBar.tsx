import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { BackButton } from './BackButton';

/**
 * Global top bar shown in AppLayout.
 * Displays a page title and a notification bell icon with an unread-count badge.
 *
 * Design reference: docs/module-design/web-app.md §5 — TopBar
 */
interface TopBarProps {
  title: string;
  showBackBtn?: boolean;
  showLogo?: boolean;
}

export function TopBar({ title, showBackBtn, showLogo }: TopBarProps) {
  const navigate = useNavigate();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 18px',
        borderBottom: '1px solid var(--surface-2)',
        background: 'rgba(15,23,42,.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {showBackBtn && <BackButton onClick={() => navigate(-1)} style={{ marginRight: 12, padding: 0 }} />}
        {showLogo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏸</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>羽约</span>
          </div>
        ) : (
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)' }}>{title}</span>
        )}
      </div>
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <BellOutlined
          style={{ fontSize: 20, cursor: 'pointer', color: 'var(--text-2)' }}
          onClick={() => navigate('/notifications')}
          aria-label="通知"
        />
      </Badge>
    </div>
  );
}
