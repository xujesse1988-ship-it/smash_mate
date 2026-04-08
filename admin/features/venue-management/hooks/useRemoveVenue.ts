import { message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteVenue } from '../api/venue-management-api';

export function useRemoveVenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: () => {
      message.success('球馆已移除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'venues'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'VENUE_NOT_FOUND':
          message.error('球馆不存在或已被移除');
          queryClient.invalidateQueries({ queryKey: ['admin', 'venues'] });
          break;
        default:
          message.error(error.message || '移除失败，请重试');
      }
    },
  });
}
