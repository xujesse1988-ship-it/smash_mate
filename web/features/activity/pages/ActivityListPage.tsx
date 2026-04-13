import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch } from 'antd';
import { useActivities } from '../hooks/useActivities';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import { ActivityCard } from '../components/ActivityCard';
import { Chip } from '../../../shared/components/Chip';

// ---------------------------------------------------------------------------
// ActivityListPage
// ---------------------------------------------------------------------------

export function ActivityListPage() {
  const navigate = useNavigate();
  const geolocation = useGeolocation();

  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [hasSlot, setHasSlot] = useState(false);
  const [sortBy, setSortBy] = useState<string>('time');
  const [showDistancePanel, setShowDistancePanel] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);

  const activitiesQuery = useActivities({
    dateFilter,
    hasSlot,
    sortBy,
    maxDistance,
    latitude: geolocation.latitude,
    longitude: geolocation.longitude,
  });

  const allActivities = activitiesQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: activitiesQuery.hasNextPage,
    isFetchingNextPage: activitiesQuery.isFetchingNextPage,
    fetchNextPage: activitiesQuery.fetchNextPage,
  });

  // Handle distance filter click
  const handleDistanceClick = () => {
    if (geolocation.permission === 'denied') return;
    if (geolocation.permission === 'prompt') {
      geolocation.requestLocation();
      return;
    }
    setShowDistancePanel(!showDistancePanel);
  };

  const dateOptions = [
    { value: 'today', label: '今天' },
    { value: 'tomorrow', label: '明天' },
    { value: 'this_week', label: '本周' },
  ];

  const distanceOptions = [3, 5, 10];

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* FilterBar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          overflowX: 'auto',
          borderBottom: '1px solid var(--surface-2)',
          alignItems: 'center',
        }}
      >
        {/* Date filter chips */}
        {dateOptions.map((opt) => (
          <Chip
            key={opt.value}
            active={dateFilter === opt.value}
            onClick={() => {
              setDateFilter(dateFilter === opt.value ? null : opt.value);
              setShowDatePanel(false);
            }}
          >
            {opt.label}
          </Chip>
        ))}

        {/* Distance filter */}
        {geolocation.permission !== 'denied' && (
          <div style={{ position: 'relative' }}>
            <Chip
              active={maxDistance !== null}
              onClick={handleDistanceClick}
            >
              {maxDistance ? `${maxDistance}km内` : '范围'}
            </Chip>
            {showDistancePanel && (
              <div
                style={{
                  position: 'absolute',
                  top: 36,
                  left: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 10,
                  padding: 8,
                  zIndex: 10,
                  minWidth: 80,
                }}
              >
                {distanceOptions.map((d) => (
                  <div
                    key={d}
                    onClick={() => {
                      setMaxDistance(d);
                      setShowDistancePanel(false);
                    }}
                    style={{ padding: '6px 16px', cursor: 'pointer', color: 'var(--text-1)', fontSize: 13 }}
                  >
                    {d}km
                  </div>
                ))}
                <div
                  onClick={() => {
                    setMaxDistance(null);
                    setShowDistancePanel(false);
                  }}
                  style={{ padding: '6px 16px', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13 }}
                >
                  不限
                </div>
              </div>
            )}
          </div>
        )}

        {/* Slot filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>有空位</span>
          <Switch size="small" checked={hasSlot} onChange={setHasSlot} />
        </div>
      </div>

      {/* Sort selector */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 14px' }}>
        <span
          onClick={() => setSortBy('time')}
          style={{
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: sortBy === 'time' ? 700 : 500,
            color: sortBy === 'time' ? 'var(--primary)' : 'var(--text-3)',
            borderBottom: sortBy === 'time' ? '2px solid var(--primary)' : '2px solid transparent',
            paddingBottom: 2,
          }}
        >
          按时间
        </span>
        {geolocation.permission === 'granted' && (
          <span
            onClick={() => setSortBy('distance')}
            style={{
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: sortBy === 'distance' ? 700 : 500,
              color: sortBy === 'distance' ? 'var(--primary)' : 'var(--text-3)',
              borderBottom: sortBy === 'distance' ? '2px solid var(--primary)' : '2px solid transparent',
              paddingBottom: 2,
            }}
          >
            按距离
          </span>
        )}
      </div>

      {/* Content area */}
      <div style={{ padding: '10px 14px 0' }}>
        {/* Loading state */}
        {activitiesQuery.isLoading && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-2)' }}>加载中...</div>
        )}

        {/* Error state */}
        {activitiesQuery.error && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--danger)' }}>加载失败，请重试</div>
        )}

        {/* Empty state */}
        {!activitiesQuery.isLoading &&
          !activitiesQuery.error &&
          activitiesQuery.data &&
          allActivities.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>暂无活动</div>
          )}

        {/* Activity list */}
        {allActivities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onClick={() => navigate(`/activities/${activity.id}`)}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {activitiesQuery.hasNextPage && (
          <div ref={sentinelRef} style={{ textAlign: 'center', padding: 16, color: 'var(--text-3)' }}>
            {activitiesQuery.isFetchingNextPage ? '加载更多...' : ''}
          </div>
        )}
      </div>

      {/* FAB - Create Activity */}
      <button
        aria-label="发起约球"
        onClick={() => navigate('/activities/create')}
        className="fab"
      >
        +
      </button>
    </div>
  );
}
