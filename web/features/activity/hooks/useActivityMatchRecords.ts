import { useQuery } from '@tanstack/react-query';

interface MatchRecordPlayer {
  userId: string | null;
  nickname: string;
  avatarUrl: string | null;
}

export interface MatchRecord {
  id: string;
  sourceType: string;
  sourceId: string;
  matchType: string;
  recordedBy: string;
  recorder: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  players: {
    sideA: MatchRecordPlayer[];
    sideB: MatchRecordPlayer[];
  };
  games: Array<{
    gameNumber: number;
    scoreA: number;
    scoreB: number;
  }>;
  result: string;
  createdAt: string;
}

function resolveUrl(path: string): string {
  if (typeof globalThis.location !== 'undefined') {
    return path;
  }
  return `http://localhost${path}`;
}

export function useActivityMatchRecords(activityId: string) {
  return useQuery<MatchRecord[]>({
    queryKey: ['activity-match-records', activityId],
    queryFn: async () => {
      const token =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('token')
          : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        resolveUrl(`/api/activities/${activityId}/match-records`),
        {
          method: 'GET',
          headers,
        },
      );

      const body = await response.json();

      if (!response.ok) {
        const error = body.error as { code: string; message: string };
        const err = new Error(error.message) as Error & { code: string };
        err.code = error.code;
        throw err;
      }

      return body.data as MatchRecord[];
    },
    enabled: !!activityId,
    staleTime: 30 * 1000,
  });
}
