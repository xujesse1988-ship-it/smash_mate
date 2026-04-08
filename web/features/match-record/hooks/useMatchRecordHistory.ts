import { useInfiniteQuery } from '@tanstack/react-query';
import { getUserMatchRecords } from '../api/match-record-api';

export function useMatchRecordHistory(
  userId: string,
  sourceType: string | null,
) {
  return useInfiniteQuery({
    queryKey: ['user-match-records', userId, { sourceType }],
    queryFn: ({ pageParam = 1 }) =>
      getUserMatchRecords(userId, {
        page: pageParam as number,
        pageSize: 20,
        sourceType: sourceType ?? undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      if (lastPage.page < totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
