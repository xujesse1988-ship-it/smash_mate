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
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 14,
          color: '#999',
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
        background: '#fff',
        border: '1px solid #d9d9d9',
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
            borderRight: index < 2 ? '1px solid #d9d9d9' : 'none',
          }}
        >
          <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>{item.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
