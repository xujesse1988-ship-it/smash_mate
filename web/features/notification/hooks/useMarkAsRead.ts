import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { markAsRead, type NotificationListResult } from '../api/notification-api';

/**
 * Hook for marking a single notification as read.
 * Implements optimistic update per design doc §6.6:
 *   1. Immediately set isRead = true locally (visual update)
 *   2. Fire API call (non-blocking)
 *   3. On success, invalidate queries to sync with server
 *   4. No rollback on failure (user has already navigated to target page)
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markAsRead(notificationId),
    onMutate: async (notificationId: string) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Optimistically update the notification's isRead to true in all cached pages
      queryClient.setQueriesData<InfiniteData<NotificationListResult>>(
        { queryKey: ['notifications'] },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === notificationId ? { ...item, isRead: true } : item,
              ),
            })),
          };
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}
