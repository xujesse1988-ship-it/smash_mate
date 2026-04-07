import { useQuery } from '@tanstack/react-query';
import { getCoachAvailability } from '../api/coaching-api';

export function useCoachAvailability(
  coachId: string,
  params?: { startDate?: string; endDate?: string },
) {
  return useQuery({
    queryKey: ['coach-availability', coachId, params],
    queryFn: () => getCoachAvailability(coachId, params),
    enabled: !!coachId,
    staleTime: 30 * 1000,
  });
}
