import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { createGroupClass } from '../api/coaching-api';

export function useCreateGroupClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      venueId: string;
      title: string;
      startTime: string;
      endTime: string;
      maxParticipants: number;
      feeDescription?: string;
    }) => createGroupClass(data),
    onSuccess: () => {
      message.success('团课发布成功');
      queryClient.invalidateQueries({ queryKey: ['coach'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_COACH_ROLE_REQUIRED':
          message.error('请先开启教练角色');
          break;
        case 'COACHING_INVALID_TITLE':
          message.error('课程名称不能为空且不超过 50 字');
          break;
        case 'COACHING_INVALID_VENUE':
          message.error('请选择球馆');
          break;
        case 'COACHING_VENUE_NOT_FOUND':
          message.error('球馆不存在，请重新选择');
          break;
        case 'COACHING_INVALID_TIME':
          message.error('开始时间必须晚于当前时间，结束时间必须晚于开始时间');
          break;
        case 'COACHING_INVALID_PARTICIPANTS':
          message.error('限定人数需在 2-30 之间');
          break;
        case 'COACHING_INVALID_FEE_DESCRIPTION':
          message.error('费用说明不超过 200 字');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
