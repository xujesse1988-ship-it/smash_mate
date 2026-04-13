import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useNotifications } from '../hooks/useNotifications';
import { useMarkAsRead } from '../hooks/useMarkAsRead';
import { useMarkAllAsRead } from '../hooks/useMarkAllAsRead';
import { useNotificationNavigate } from '../hooks/useNotificationNavigate';
import { useUnreadCount } from '../../../shared/hooks/useUnreadCount';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import { BackButton } from '../../../shared/components/BackButton';
import { NotificationFilter, type FilterStatus } from '../components/notification-filter';
import { MarkAllReadButton } from '../components/mark-all-read-button';
import { NotificationList } from '../components/notification-list';
import type { NotificationItem } from '../api/notification-api';

export function NotificationListPage() {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Convert filterStatus to isRead parameter
  const isReadParam = filterStatus === 'all' ? undefined : filterStatus === 'read';

  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useNotifications({ isRead: isReadParam });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const { navigateToTarget } = useNotificationNavigate();
  const unreadCount = useUnreadCount();

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Flatten pages into single list
  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  const handleFilterChange = useCallback((status: FilterStatus) => {
    setFilterStatus(status);
  }, []);

  const handleClickNotification = useCallback(
    (notification: NotificationItem) => {
      // If unread, mark as read (optimistic, non-blocking)
      if (!notification.isRead) {
        markAsRead.mutate(notification.id);
      }
      // Navigate to target page
      navigateToTarget(notification.targetType, notification.targetId);
    },
    [markAsRead, navigateToTarget],
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead.mutate();
  }, [markAllAsRead]);

  const pageHeader = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--surface-2)',
        background: 'rgba(15,23,42,.95)',
        backdropFilter: 'blur(12px)',
        margin: '-16px -16px 16px',
      }}
    >
      <BackButton onClick={() => navigate(-1)} />
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>通知</h2>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        {pageHeader}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <NotificationFilter value={filterStatus} onChange={handleFilterChange} />
        </div>
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: 16 }}>
        {pageHeader}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <NotificationFilter value={filterStatus} onChange={handleFilterChange} />
        </div>
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>加载失败，请重试</div>
      </div>
    );
  }

  const hasUnread = (unreadCount.data?.count ?? 0) > 0;

  return (
    <div style={{ padding: 16 }}>
      {pageHeader}
      {/* Filter tabs + mark all read button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <NotificationFilter value={filterStatus} onChange={handleFilterChange} />
        {hasUnread && (
          <MarkAllReadButton onClick={handleMarkAllAsRead} isPending={markAllAsRead.isPending} />
        )}
      </div>

      {/* Notification list or empty state */}
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>暂无通知</div>
      ) : (
        <NotificationList
          notifications={notifications}
          onClickItem={handleClickNotification}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          sentinelRef={sentinelRef}
        />
      )}
    </div>
  );
}
