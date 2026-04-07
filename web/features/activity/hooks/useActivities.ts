import { useInfiniteQuery } from '@tanstack/react-query';
import { getActivities, type PaginatedResult, type ActivityListItem } from '../api/activity-api';

interface UseActivitiesParams {
  dateFilter?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  maxDistance?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  hasSlot?: boolean;
  sortBy?: string;
}

export function useActivities(params: UseActivitiesParams = {}) {
  return useInfiniteQuery<PaginatedResult<ActivityListItem>>({
    queryKey: [
      'activities',
      {
        dateFilter: params.dateFilter,
        dateStart: params.dateStart,
        dateEnd: params.dateEnd,
        maxDistance: params.maxDistance,
        latitude: params.latitude,
        longitude: params.longitude,
        hasSlot: params.hasSlot,
        sortBy: params.sortBy,
      },
    ],
    queryFn: ({ pageParam }) => {
      const apiParams: Record<string, unknown> = {
        page: pageParam as number,
        pageSize: 20,
      };
      if (params.dateFilter) apiParams.dateFilter = params.dateFilter;
      if (params.dateStart) apiParams.dateStart = params.dateStart;
      if (params.dateEnd) apiParams.dateEnd = params.dateEnd;
      if (params.maxDistance != null) apiParams.maxDistance = params.maxDistance;
      if (params.latitude != null) apiParams.latitude = params.latitude;
      if (params.longitude != null) apiParams.longitude = params.longitude;
      if (params.hasSlot) apiParams.hasSlot = true;
      if (params.sortBy) apiParams.sortBy = params.sortBy;

      return getActivities(apiParams as Parameters<typeof getActivities>[0]);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    staleTime: 30 * 1000,
  });
}
