import React from 'react';
import { Spin } from 'antd';
import type { NotificationItem as NotificationItemType } from '../api/notification-api';
import { NotificationItem } from './notification-item';

interface NotificationListProps {
  notifications: NotificationItemType[];
  onClickItem: (notification: NotificationItemType) => void;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  sentinelRef: (node: HTMLElement | null) => void;
}

export function NotificationList({
  notifications,
  onClickItem,
  isFetchingNextPage,
  hasNextPage,
  sentinelRef,
}: NotificationListProps) {
  return (
    <div>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClick={onClickItem}
        />
      ))}

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} />

      {isFetchingNextPage && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="small" />
        </div>
      )}

      {!hasNextPage && notifications.length > 0 && (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-3)', fontSize: 13 }}>
          没有更多了
        </div>
      )}
    </div>
  );
}
