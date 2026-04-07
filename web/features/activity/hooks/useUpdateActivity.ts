import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { updateActivity } from '../api/activity-api';

interface UpdateParams {
  activityId: string;
  data: {
    venueId?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    maxParticipants?: number;
  };
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateParams) =>
      updateActivity(params.activityId, params.data),
    onSuccess: (_data, params) => {
      message.success('修改成功');
      queryClient.invalidateQueries({
        queryKey: ['activity', params.activityId],
      });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'ACTIVITY_NOT_CREATOR':
          message.error('只有发起人可以修改活动');
          break;
        case 'ACTIVITY_NOT_MODIFIABLE':
          message.error('活动已开始或已结束，无法修改');
          break;
        case 'ACTIVITY_INVALID_VENUE':
          message.error('请选择球馆');
          break;
        case 'ACTIVITY_INVALID_TIME':
          message.error(
            '开始时间必须晚于当前时间，结束时间必须晚于开始时间',
          );
          break;
        case 'ACTIVITY_INVALID_PARTICIPANTS':
          message.error('限定人数需在 2-50 之间');
          break;
        case 'ACTIVITY_INVALID_TITLE':
          message.error('标题不能超过 50 个字符');
          break;
        case 'ACTIVITY_PARTICIPANTS_EXCEED':
          message.error('限定人数不能少于当前参与人数');
          break;
        case 'ACTIVITY_VENUE_NOT_FOUND':
          message.error('选择的球馆不存在，请重新选择');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
