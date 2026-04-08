import { useQuery } from '@tanstack/react-query';
import { getUserMatchStats } from '../api/match-record-api';

export function useMatchStats(userId: string) {
  return useQuery({
    queryKey: ['user-match-stats', userId],
    queryFn: () => getUserMatchStats(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
