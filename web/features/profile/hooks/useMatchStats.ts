import { useQuery } from '@tanstack/react-query';
import { getMatchStats } from '../api/profile-api';

export function useMatchStats(userId: string) {
  return useQuery({
    queryKey: ['match-stats', userId],
    queryFn: () => getMatchStats(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
