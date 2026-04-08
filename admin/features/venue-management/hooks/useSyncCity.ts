import { message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncCity } from '../api/venue-management-api';

export function useSyncCity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cityId: string) => syncCity(cityId),
    onSuccess: () => {
      message.success('球馆数据同步已开始，稍后刷新查看结果');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cities'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'venues'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'VENUE_SYNC_IN_PROGRESS':
          message.warning('该城市正在同步中，请稍后再试');
          break;
        case 'VENUE_CITY_NOT_FOUND':
          message.error('城市不存在');
          break;
        default:
          message.error(error.message || '同步失败，请重试');
      }
    },
  });
}
