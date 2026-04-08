import { message, notification } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncVenues } from '../api/venue-management-api';

export function useSyncVenues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => syncVenues(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'venues'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'cities'] });

      if (result.syncResults.length > 0) {
        const description = result.syncResults
          .map(
            (r) =>
              `${r.cityName}: 新增 ${r.newVenues} 个，更新 ${r.updatedVenues} 个，共 ${r.totalVenues} 个`,
          )
          .join('\n');

        notification.success({
          message: '球馆数据同步完成',
          description,
          duration: 10,
        });
      } else {
        message.success('球馆数据同步完成');
      }
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'VENUE_SYNC_IN_PROGRESS':
          message.warning('同步正在进行中，请稍后再试');
          break;
        default:
          message.error(error.message || '同步失败，请重试');
      }
    },
  });
}
