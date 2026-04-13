import React from 'react';
import type { MatchStats } from '../api/profile-api';

interface MatchStatsCardProps {
  stats: MatchStats | undefined;
  error: unknown;
}

export function MatchStatsCard({ stats, error }: MatchStatsCardProps) {
  if (error) {
    return (
      <div
        style={{
          marginTop: 20,
          padding: '16px 18px',
          background: 'var(--surface)',
          border: '1px solid var(--surface-2)',
          borderRadius: 14,
          color: 'var(--text-3)',
          fontSize: 14,
        }}
      >
        战绩加载失败
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        marginTop: 20,
        background: 'var(--surface)',
        border: '1px solid var(--surface-2)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {[
        { label: '总场次', value: stats.totalMatches },
        { label: '胜场', value: stats.wins },
        { label: '胜率', value: `${stats.winRate}%` },
      ].map((item, index) => (
        <div
          key={item.label}
          style={{
            padding: '14px 8px',
            textAlign: 'center',
            borderRight: index < 2 ? '1px solid var(--surface-2)' : 'none',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 8 }}>{item.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
