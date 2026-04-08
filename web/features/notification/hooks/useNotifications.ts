import { useInfiniteQuery } from '@tanstack/react-query';
import { getNotifications, type NotificationListResult } from '../api/notification-api';

interface UseNotificationsParams {
  isRead?: boolean;
}

/**
 * Hook for fetching paginated notification list with infinite scroll support.
 * Supports isRead filter (undefined = all, true = read, false = unread).
 */
export function useNotifications(params: UseNotificationsParams = {}) {
  return useInfiniteQuery<NotificationListResult>({
    queryKey: ['notifications', { isRead: params.isRead }],
    queryFn: ({ pageParam }) =>
      getNotifications({
        page: pageParam as number,
        pageSize: 20,
        ...(params.isRead !== undefined ? { isRead: params.isRead } : {}),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    staleTime: 30 * 1000,
  });
}
