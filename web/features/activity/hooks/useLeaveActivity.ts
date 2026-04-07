import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { leaveActivity } from '../api/activity-api';

export function useLeaveActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityId: string) => leaveActivity(activityId),
    onSuccess: (_data, activityId) => {
      message.success('已退出活动');
      queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'ACTIVITY_NOT_FOUND':
          message.error('活动不存在');
          break;
        case 'ACTIVITY_CREATOR_CANNOT_LEAVE':
          message.error('发起人不能退出活动，如需取消请使用「取消活动」');
          break;
        case 'ACTIVITY_NOT_LEAVABLE':
          message.error('活动已开始或已结束，无法退出');
          break;
        case 'ACTIVITY_NOT_PARTICIPANT':
          message.error('你不是该活动的参与者');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
