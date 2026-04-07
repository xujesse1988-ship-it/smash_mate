import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { setAvailability } from '../api/coaching-api';

export function useSetAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      slots: Array<{
        startTime: string;
        endTime: string;
        venueIds?: string[];
        feeDescription?: string;
      }>;
    }) => setAvailability(data),
    onSuccess: () => {
      message.success('私教时间已添加');
      queryClient.invalidateQueries({ queryKey: ['coach-availability'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_COACH_ROLE_REQUIRED':
          message.error('请先开启教练角色');
          break;
        case 'COACHING_INVALID_SLOTS':
          message.error('请添加至少一个时间段');
          break;
        case 'COACHING_INVALID_SLOT_TIME':
          message.error('时间设置有误：开始时间必须晚于当前时间，结束时间必须晚于开始时间');
          break;
        case 'COACHING_SLOT_TOO_SHORT':
          message.error('时间段至少为 1 小时');
          break;
        case 'COACHING_INVALID_FEE_DESCRIPTION':
          message.error('费用说明不超过 200 字');
          break;
        case 'COACHING_VENUE_NOT_FOUND':
          message.error('选择的球馆不存在');
          break;
        case 'COACHING_SLOT_OVERLAP':
          message.error('时间段与已有时间段重叠');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
