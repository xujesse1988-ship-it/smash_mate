import { useInfiniteQuery } from '@tanstack/react-query';
import { getCoaches, type PaginatedResult, type CoachListItem } from '../api/coaching-api';

export function useCoachList(params: { specialty?: string | null } = {}) {
  return useInfiniteQuery<PaginatedResult<CoachListItem>>({
    queryKey: ['coaches', { specialty: params.specialty }],
    queryFn: ({ pageParam }) => {
      const apiParams: { page?: number; pageSize?: number; specialty?: string } = {
        page: pageParam as number,
        pageSize: 20,
      };
      if (params.specialty) {
        apiParams.specialty = params.specialty;
      }
      return getCoaches(apiParams);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    staleTime: 30 * 1000,
  });
}
