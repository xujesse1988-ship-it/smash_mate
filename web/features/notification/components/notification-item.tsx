import React from 'react';
import type { NotificationItem as NotificationItemType } from '../api/notification-api';
import { formatNotificationTime } from '../utils/format-time';

interface NotificationItemProps {
  notification: NotificationItemType;
  onClick: (notification: NotificationItemType) => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const isUnread = !notification.isRead;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(notification)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick(notification);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '12px 16px',
        backgroundColor: isUnread ? '#F0F5FF' : '#fff',
        cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {/* Unread indicator dot */}
      <div style={{ width: 20, flexShrink: 0, paddingTop: 6 }}>
        {isUnread && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#1677ff',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: isUnread ? 600 : 400,
            fontSize: 14,
            marginBottom: 4,
            color: '#333',
          }}
        >
          {notification.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: isUnread ? '#666' : '#999',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {notification.content}
        </div>
        <div style={{ fontSize: 12, color: '#999' }}>
          {formatNotificationTime(notification.createdAt)}
        </div>
      </div>
    </div>
  );
}
