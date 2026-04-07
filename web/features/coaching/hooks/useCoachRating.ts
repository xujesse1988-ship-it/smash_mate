import { useQuery } from '@tanstack/react-query';
import { getCoachRating } from '../api/review-api';

export function useCoachRating(coachId: string) {
  return useQuery({
    queryKey: ['coach-rating', coachId],
    queryFn: () => getCoachRating(coachId),
    enabled: !!coachId,
    staleTime: 30 * 1000,
  });
}
