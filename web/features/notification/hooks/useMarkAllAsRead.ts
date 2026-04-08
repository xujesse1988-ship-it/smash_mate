import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { markAllAsRead } from '../api/notification-api';

/**
 * Hook for marking all notifications as read.
 * On success, shows a success message and invalidates notification list and unread count queries.
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      message.success('已全部标记为已读');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: () => {
      message.error('操作失败');
    },
  });
}
