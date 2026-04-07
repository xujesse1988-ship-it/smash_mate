import { useInfiniteQuery } from '@tanstack/react-query';
import { getCoachReviews, type PaginatedResult, type ReviewItem } from '../api/review-api';

export function useCoachReviews(coachId: string) {
  return useInfiniteQuery<PaginatedResult<ReviewItem>>({
    queryKey: ['coach-reviews', coachId],
    queryFn: ({ pageParam }) =>
      getCoachReviews(coachId, { page: pageParam as number, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: !!coachId,
    staleTime: 30 * 1000,
  });
}
