import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Tag } from 'antd';
import { useMatchStats } from '../hooks/useMatchStats';
import { useMatchRecordHistory } from '../hooks/useMatchRecordHistory';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import type { MatchRecord } from '../api/match-record-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceTypeFilter = 'activity' | 'group-class' | 'private-lesson' | null;

interface MatchStatsData {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

const FILTER_TABS: Array<{ label: string; value: SourceTypeFilter }> = [
  { label: '全部', value: null },
  { label: '约球活动', value: 'activity' },
  { label: '团课', value: 'group-class' },
  { label: '私教', value: 'private-lesson' },
];

const MATCH_TYPE_LABELS: Record<string, string> = {
  singles: '单打',
  doubles: '双打',
};

const USER_RESULT_CONFIG: Record<string, { label: string; color: string }> = {
  WIN: { label: '胜', color: 'success' },
  LOSE: { label: '负', color: 'error' },
  DRAW: { label: '平', color: 'default' },
};

// ---------------------------------------------------------------------------
// StatsCard — renders all stats in one container to avoid ambiguous text matches
// ---------------------------------------------------------------------------

function StatsCard({ stats }: { stats: MatchStatsData }) {
  return (
    <div
      data-testid="match-stats-card"
      style={{
        padding: 12,
        background: '#fafafa',
        borderRadius: 8,
        textAlign: 'center',
        lineHeight: 2,
      }}
    >
      <span>
        {stats.totalMatches}场 {stats.wins}胜 {stats.losses}负 {stats.draws}平 胜率{stats.winRate}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchRecordHistoryPage() {
  const { id: userId } = useParams<{ id: string }>();
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>(null);

  const statsQuery = useMatchStats(userId ?? '');
  const recordsQuery = useMatchRecordHistory(userId ?? '', sourceTypeFilter);

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: recordsQuery.hasNextPage,
    isFetchingNextPage: recordsQuery.isFetchingNextPage,
    fetchNextPage: recordsQuery.fetchNextPage,
  });

  // Flatten pages into a single array of records
  const records: MatchRecord[] = useMemo(() => {
    if (!recordsQuery.data?.pages) return [];
    return recordsQuery.data.pages.flatMap(
      (page: { items: MatchRecord[] }) => page.items,
    );
  }, [recordsQuery.data]);

  // Stats with fallback to zeros
  const stats: MatchStatsData = (statsQuery.data as MatchStatsData) ?? {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Stats Card */}
      <div style={{ marginBottom: 16 }}>
        {statsQuery.isLoading ? (
          <div>加载中...</div>
        ) : (
          <StatsCard stats={stats} />
        )}
      </div>

      {/* Source Type Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setSourceTypeFilter(tab.value)}
            style={{
              padding: '4px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              background: sourceTypeFilter === tab.value ? '#1890ff' : '#fff',
              color: sourceTypeFilter === tab.value ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Records List */}
      {recordsQuery.isLoading ? (
        <div>加载中...</div>
      ) : recordsQuery.error ? (
        <div>加载失败，请重试</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
          暂无战绩记录
        </div>
      ) : (
        <div>
          {records.map((record: MatchRecord) => {
            const r = record;

            const resultConfig = USER_RESULT_CONFIG[r.userResult ?? ''] ?? {
              label: '?',
              color: 'default',
            };

            const dateStr = formatDate(r.createdAt);

            return (
              <div
                key={r.id}
                style={{
                  border: '1px solid #e8e8e8',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: '#888', fontSize: 12 }}>{dateStr}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Tag>{MATCH_TYPE_LABELS[r.matchType] ?? r.matchType}</Tag>
                    <Tag color={resultConfig.color}>{resultConfig.label}</Tag>
                  </div>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span>
                    {r.players.sideA.map((p) => p.nickname).join(' & ')}
                  </span>
                  <span style={{ margin: '0 8px', color: '#999' }}>vs</span>
                  <span>
                    {r.players.sideB.map((p) => p.nickname).join(' & ')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {r.games.map((g) => `${g.scoreA}:${g.scoreB}`).join('  ')}
                </div>
              </div>
            );
          })}
          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {recordsQuery.isFetchingNextPage && (
            <div style={{ textAlign: 'center', padding: 8 }}>加载中...</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
