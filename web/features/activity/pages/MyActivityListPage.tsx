import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useMyActivities } from '../hooks/useMyActivities';
import type { ActivityListItem } from '../api/activity-api';

// ---------------------------------------------------------------------------
// Status label map
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  open: '报名中',
  full: '已满员',
  in_progress: '进行中',
  completed: '已结束',
  cancelled: '已取消',
};

// Map URL query param role values to API role values
const ROLE_MAP: Record<string, string | null> = {
  all: null,
  initiated: 'creator',
  participated: 'participant',
};

const ROLE_REVERSE_MAP: Record<string, string> = {
  creator: 'initiated',
  participant: 'participated',
};

// ---------------------------------------------------------------------------
// ActivityCard (reused from list page)
// ---------------------------------------------------------------------------

function ActivityCard({
  activity,
  onClick,
}: {
  activity: ActivityListItem;
  onClick: () => void;
}) {
  const displayTitle = activity.title
    ? activity.title
    : activity.venue
      ? activity.venue.name
      : '已删除的球馆';

  const startDate = new Date(activity.startTime);
  const endDate = new Date(activity.endTime);
  const timeStr = `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

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
            background: activity.status === 'open' ? '#e6f7ff' : activity.status === 'completed' ? '#f6ffed' : '#f5f5f5',
            color: activity.status === 'open' ? '#1890ff' : activity.status === 'completed' ? '#52c41a' : '#999',
          }}
        >
          {STATUS_LABELS[activity.status] || activity.status}
        </span>
      </div>
      {activity.venue && (
        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
          {activity.venue.name}
        </div>
      )}
      <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{timeStr}</div>
      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: 13, color: '#666' }}>
          {activity.currentParticipants}/{activity.maxParticipants} 人
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MyActivityListPage
// ---------------------------------------------------------------------------

export function MyActivityListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = useAuthStore((state) => state.userId);

  // Parse initial role from URL
  const urlRole = searchParams.get('role') || 'all';
  const initialApiRole = ROLE_MAP[urlRole] ?? null;

  const [activeTab, setActiveTab] = useState<string>(urlRole);
  const [role, setRole] = useState<string | null>(initialApiRole);
  const [status, setStatus] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const activitiesQuery = useMyActivities({
    userId: currentUserId || '',
    role,
    status,
  });

  const allActivities = useMemo(
    () => activitiesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activitiesQuery.data],
  );

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setRole(ROLE_MAP[tab] ?? null);
  };

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'initiated', label: '我发起的' },
    { key: 'participated', label: '我参加的' },
  ];

  const statusOptions = [
    { value: null, label: '全部状态' },
    { value: 'open', label: '报名中' },
    { value: 'full', label: '已满员' },
    { value: 'in_progress', label: '进行中' },
    { value: 'completed', label: '已结束' },
    { value: 'cancelled', label: '已取消' },
  ];

  return (
    <div>
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <button
          aria-label="返回"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, marginRight: 8 }}
        >
          &lt; 返回
        </button>
        <h2 style={{ margin: 0, fontSize: 18 }}>我的活动</h2>
      </div>

      {/* Role filter tabs */}
      <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #00C853' : '2px solid transparent',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#00C853' : '#666',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div style={{ padding: '8px 16px', position: 'relative' }}>
        <button
          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
          style={{ fontSize: 13, padding: '2px 8px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
        >
          状态{status ? `: ${STATUS_LABELS[status]}` : ''}
        </button>
        {showStatusDropdown && (
          <div style={{ position: 'absolute', top: 36, left: 16, background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 8, zIndex: 10 }}>
            {statusOptions.map((opt) => (
              <div
                key={opt.value ?? 'all'}
                onClick={() => {
                  setStatus(opt.value);
                  setShowStatusDropdown(false);
                }}
                style={{ padding: '4px 16px', cursor: 'pointer' }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {activitiesQuery.isLoading && (
        <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>
      )}

      {/* Error state */}
      {activitiesQuery.error && (
        <div style={{ textAlign: 'center', padding: 48, color: 'red' }}>
          加载失败，请重试
        </div>
      )}

      {/* Empty state */}
      {!activitiesQuery.isLoading &&
        !activitiesQuery.error &&
        activitiesQuery.data &&
        allActivities.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            暂无活动
          </div>
        )}

      {/* Activity list */}
      {allActivities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onClick={() => navigate(`/activities/${activity.id}`)}
        />
      ))}
    </div>
  );
}
