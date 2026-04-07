import { useInfiniteQuery } from '@tanstack/react-query';
import { getUserActivities, type PaginatedResult, type ActivityListItem } from '../api/activity-api';

interface UseMyActivitiesParams {
  userId: string;
  role?: string | null;
  status?: string | null;
}

export function useMyActivities(params: UseMyActivitiesParams) {
  return useInfiniteQuery<PaginatedResult<ActivityListItem>>({
    queryKey: [
      'user-activities',
      params.userId,
      { role: params.role, status: params.status },
    ],
    queryFn: ({ pageParam }) => {
      const apiParams: Record<string, unknown> = {
        page: pageParam as number,
        pageSize: 20,
      };
      if (params.role) apiParams.role = params.role;
      if (params.status) apiParams.status = params.status;

      return getUserActivities(
        params.userId,
        apiParams as Parameters<typeof getUserActivities>[1],
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: !!params.userId,
    staleTime: 30 * 1000,
  });
}
