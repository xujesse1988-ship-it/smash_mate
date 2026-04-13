import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Tag } from 'antd';
import { BackButton } from '../../../shared/components/BackButton';
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
        padding: 16,
        background: 'var(--surface)',
        border: '1px solid var(--surface-2)',
        borderRadius: 16,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: '总场次', value: stats.totalMatches },
          { label: '胜场', value: stats.wins },
          { label: '负场', value: stats.losses },
          { label: '平局', value: stats.draws },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--surface-2)',
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--text-2)',
        }}
      >
        胜率 <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{stats.winRate}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchRecordHistoryPage() {
  const navigate = useNavigate();
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
    return recordsQuery.data.pages.flatMap((page: { items: MatchRecord[] }) => page.items);
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
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingBottom: 12,
            marginBottom: 16,
            borderBottom: '1px solid var(--surface-2)',
          }}
        >
          <BackButton onClick={() => navigate(-1)} style={{ marginRight: 8 }} />
          <h2 style={{ margin: 0, fontSize: 18 }}>战绩记录</h2>
        </div>

        <div style={{ marginBottom: 16 }}>
          {statsQuery.isLoading ? <div>加载中...</div> : <StatsCard stats={stats} />}
        </div>

        <section
          style={{
            padding: 18,
            background: 'var(--surface)',
            border: '1px solid var(--surface-2)',
            borderRadius: 18,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 12 }}>
            筛选战绩
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.label}
                onClick={() => setSourceTypeFilter(tab.value)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid var(--surface-2)',
                  borderRadius: 999,
                  background: sourceTypeFilter === tab.value ? 'var(--text-1)' : 'var(--surface)',
                  color: sourceTypeFilter === tab.value ? 'var(--bg)' : 'var(--text-1)',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 18,
            background: 'var(--surface)',
            border: '1px solid var(--surface-2)',
            borderRadius: 18,
          }}
        >
          {recordsQuery.isLoading ? (
            <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 24 }}>加载中...</div>
          ) : recordsQuery.error ? (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>加载失败，请重试</div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>暂无战绩记录</div>
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
                      border: '1px solid var(--surface-2)',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      background: 'var(--surface-2)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{dateStr}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Tag>{MATCH_TYPE_LABELS[r.matchType] ?? r.matchType}</Tag>
                        <Tag color={resultConfig.color}>{resultConfig.label}</Tag>
                      </div>
                    </div>
                    <div style={{ marginBottom: 6, fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                      <span>{r.players.sideA.map((p) => p.nickname).join(' & ')}</span>
                      <span style={{ margin: '0 8px', color: 'var(--text-3)', fontWeight: 400 }}>vs</span>
                      <span>{r.players.sideB.map((p) => p.nickname).join(' & ')}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {r.games.map((g) => `${g.scoreA}:${g.scoreB}`).join('  ')}
                    </div>
                  </div>
                );
              })}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {recordsQuery.isFetchingNextPage && (
                <div style={{ textAlign: 'center', padding: 8 }}>加载中...</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
