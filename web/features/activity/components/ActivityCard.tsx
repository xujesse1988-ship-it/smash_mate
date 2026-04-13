import React from 'react';
import type { ActivityListItem } from '../api/activity-api';
import { STATUS_LABELS } from '../constants';
import { StatusBadge } from '../../../shared/components/StatusBadge';

type BadgeVariant = 'green' | 'gray' | 'blue' | 'red' | 'yellow' | 'purple';

function getStatusVariant(status: string, variant: 'list' | 'my'): BadgeVariant {
  if (status === 'open') return 'green';
  if (variant === 'my' && status === 'completed') return 'blue';
  if (status === 'in_progress') return 'blue';
  if (status === 'cancelled') return 'red';
  if (status === 'full') return 'yellow';
  return 'gray';
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

  const isOpen = activity.status === 'open';
  const badgeVariant = getStatusVariant(activity.status, variant);

  return (
    <div
      onClick={onClick}
      className={`dark-card${isOpen ? ' dark-card-accent' : ''}`}
      style={{
        marginBottom: 10,
        cursor: 'pointer',
        opacity: activity.status === 'full' || activity.status === 'cancelled' ? 0.8 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3 }}>{displayTitle}</div>
        <StatusBadge variant={badgeVariant}>
          {STATUS_LABELS[activity.status] || activity.status}
        </StatusBadge>
      </div>
      {showVenueSeparately && (
        <div className="info-row" style={{ marginTop: 8 }}>
          <span className="icon">📍</span>
          {activity.venue!.name}
        </div>
      )}
      <div className="info-row" style={showVenueSeparately ? {} : { marginTop: 8 }}>
        <span className="icon">🕐</span>
        {timeStr}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {activity.currentParticipants}/{activity.maxParticipants} 人
        </span>
        {variant === 'list' && activity.distance != null && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            距你 {activity.distance} km
          </span>
        )}
      </div>
    </div>
  );
}
