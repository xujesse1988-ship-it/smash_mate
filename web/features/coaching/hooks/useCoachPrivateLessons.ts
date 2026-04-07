import { useQuery } from '@tanstack/react-query';
import { getCoachPrivateLessons } from '../api/coaching-api';

export function useCoachPrivateLessons(
  coachId: string,
  params?: { status?: string },
) {
  return useQuery({
    queryKey: ['coach-private-lessons', coachId, params],
    queryFn: () => getCoachPrivateLessons(coachId, { ...params }),
    enabled: !!coachId,
    staleTime: 30 * 1000,
  });
}
