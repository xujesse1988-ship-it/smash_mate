import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { joinActivity } from '../api/activity-api';

export function useJoinActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityId: string) => joinActivity(activityId),
    onSuccess: (_data, activityId) => {
      message.success('加入成功');
      queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'ACTIVITY_NOT_FOUND':
          message.error('活动不存在');
          break;
        case 'ACTIVITY_FULL':
          message.error('活动已满员');
          break;
        case 'ACTIVITY_ALREADY_JOINED':
          message.error('你已经加入了该活动');
          break;
        case 'ACTIVITY_NOT_JOINABLE':
          message.error('活动当前状态不允许加入');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
