import React from 'react';
import type { ActivityListItem } from '../api/activity-api';
import { STATUS_LABELS } from '../constants';

function getStatusStyle(status: string, variant: 'list' | 'my') {
  if (status === 'open') {
    return { background: '#e6f7ff', color: '#1890ff' };
  }
  if (variant === 'my' && status === 'completed') {
    return { background: '#f6ffed', color: '#52c41a' };
  }
  return { background: '#f5f5f5', color: '#999' };
}

export function ActivityCard({
  activity,
  onClick,
  variant = 'list',
}: {
  activity: ActivityListItem;
  onClick: () => void;
  variant?: 'list' | 'my';
}) {
  const displayTitle = activity.title
    ? activity.title
    : activity.venue
      ? activity.venue.name
      : '已删除的球馆';

  const startDate = new Date(activity.startTime);
  const endDate = new Date(activity.endTime);
  const timeStr = `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  // In "list" variant: only show venue separately when title is set (otherwise venue name is already in displayTitle)
  // In "my" variant: always show venue if available
  const showVenueSeparately =
    variant === 'my'
      ? activity.venue !== null
      : activity.title !== null && activity.venue !== null;

  const statusStyle = getStatusStyle(activity.status, variant);

  return (
    <div
      onClick={onClick}
      style={{
        padding: 16,
        borderBottom: '1px solid #f0f0f0',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{displayTitle}</h3>
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 4,
            background: statusStyle.background,
            color: statusStyle.color,
          }}
        >
          {STATUS_LABELS[activity.status] || activity.status}
        </span>
      </div>
      {showVenueSeparately && (
        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
          {activity.venue!.name}
        </div>
      )}
      <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{timeStr}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 13, color: '#666' }}>
          {activity.currentParticipants}/{activity.maxParticipants} 人
        </span>
        {variant === 'list' && activity.distance != null && (
          <span style={{ fontSize: 13, color: '#999' }}>
            距你 {activity.distance} km
          </span>
        )}
      </div>
    </div>
  );
}
