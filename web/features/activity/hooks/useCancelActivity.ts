import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { cancelActivity } from '../api/activity-api';

export function useCancelActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityId: string) => cancelActivity(activityId),
    onSuccess: (_data, activityId) => {
      message.success('活动已取消');
      queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'ACTIVITY_NOT_CREATOR':
          message.error('只有发起人可以取消活动');
          break;
        case 'ACTIVITY_NOT_CANCELLABLE':
          message.error('活动已开始或已结束，无法取消');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
