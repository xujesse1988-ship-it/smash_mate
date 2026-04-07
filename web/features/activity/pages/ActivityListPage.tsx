import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch } from 'antd';
import { useActivities } from '../hooks/useActivities';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import { ActivityCard } from '../components/ActivityCard';

// ---------------------------------------------------------------------------
// ActivityListPage
// ---------------------------------------------------------------------------

export function ActivityListPage() {
  const navigate = useNavigate();
  const geolocation = useGeolocation();

  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [hasSlot, setHasSlot] = useState(false);
  const [sortBy, setSortBy] = useState<string>('time');
  const [showDatePanel, setShowDatePanel] = useState(false);
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

  const allActivities =
    activitiesQuery.data?.pages.flatMap((page) => page.items) ?? [];

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

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* FilterBar */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
        {/* Time filter button - uses "日期" to not conflict with sort "按时间" */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDatePanel(!showDatePanel)}
            style={{ fontSize: 13, padding: '2px 8px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
          >
            日期{dateFilter ? ` (${dateFilter === 'today' ? '今天' : dateFilter === 'tomorrow' ? '明天' : '本周'})` : ''}
          </button>
          {showDatePanel && (
            <div style={{ position: 'absolute', top: 32, left: 0, background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 8, zIndex: 10 }}>
              {['today', 'tomorrow', 'this_week'].map((f) => (
                <div
                  key={f}
                  onClick={() => { setDateFilter(f); setShowDatePanel(false); }}
                  style={{ padding: '4px 16px', cursor: 'pointer' }}
                >
                  {f === 'today' ? '今天' : f === 'tomorrow' ? '明天' : '本周'}
                </div>
              ))}
              <div
                onClick={() => { setDateFilter(null); setShowDatePanel(false); }}
                style={{ padding: '4px 16px', cursor: 'pointer', color: '#999' }}
              >
                不限
              </div>
            </div>
          )}
        </div>

        {/* Distance filter - hidden when denied */}
        {geolocation.permission !== 'denied' && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={handleDistanceClick}
              style={{ fontSize: 13, padding: '2px 8px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
            >
              范围{maxDistance ? ` (${maxDistance}km)` : ''}
            </button>
            {showDistancePanel && (
              <div style={{ position: 'absolute', top: 32, left: 0, background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 8, zIndex: 10 }}>
                {[3, 5, 10].map((d) => (
                  <div
                    key={d}
                    onClick={() => { setMaxDistance(d); setShowDistancePanel(false); }}
                    style={{ padding: '4px 16px', cursor: 'pointer' }}
                  >
                    {d}km
                  </div>
                ))}
                <div
                  onClick={() => { setMaxDistance(null); setShowDistancePanel(false); }}
                  style={{ padding: '4px 16px', cursor: 'pointer', color: '#999' }}
                >
                  不限
                </div>
              </div>
            )}
          </div>
        )}

        {/* Slot filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13 }}>有空位</span>
          <Switch size="small" checked={hasSlot} onChange={setHasSlot} />
        </div>
      </div>

      {/* Sort selector */}
      <div style={{ padding: '4px 16px', display: 'flex', gap: 8, fontSize: 13 }}>
        <span
          onClick={() => setSortBy('time')}
          style={{ cursor: 'pointer', color: sortBy === 'time' ? '#00C853' : '#666', fontWeight: sortBy === 'time' ? 600 : 400 }}
        >
          按时间
        </span>
        {geolocation.permission === 'granted' && (
          <span
            onClick={() => setSortBy('distance')}
            style={{ cursor: 'pointer', color: sortBy === 'distance' ? '#00C853' : '#666', fontWeight: sortBy === 'distance' ? 600 : 400 }}
          >
            按距离
          </span>
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

      {/* Infinite scroll sentinel */}
      {activitiesQuery.hasNextPage && (
        <div ref={sentinelRef} style={{ textAlign: 'center', padding: 16 }}>
          {activitiesQuery.isFetchingNextPage ? '加载更多...' : ''}
        </div>
      )}

      {/* FAB - Create Activity */}
      <button
        aria-label="发起约球"
        onClick={() => navigate('/activities/create')}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#00C853',
          color: '#fff',
          fontSize: 28,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>
    </div>
  );
}
