import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markAsRead } from '../api/notification-api';

/**
 * Hook for marking a single notification as read.
 * On success, invalidates both the notification list and unread count queries.
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}
