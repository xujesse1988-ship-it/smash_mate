import React from 'react';
import type { MatchStats } from '../api/profile-api';

interface MatchStatsCardProps {
  stats: MatchStats | undefined;
  error: unknown;
}

export function MatchStatsCard({ stats, error }: MatchStatsCardProps) {
  if (error) {
    return <div>战绩加载失败</div>;
  }

  if (!stats) {
    return null;
  }

  return (
    <div>
      <div>{stats.totalMatches}</div>
      <div>{stats.wins}</div>
      <div>{stats.winRate}%</div>
    </div>
  );
}
