import { useQuery } from '@tanstack/react-query';
import { getCoachProfile } from '../api/coaching-api';

export function useCoachProfile(coachId: string) {
  return useQuery({
    queryKey: ['coach', coachId],
    queryFn: () => getCoachProfile(coachId),
    enabled: !!coachId,
    staleTime: 30 * 1000,
  });
}
