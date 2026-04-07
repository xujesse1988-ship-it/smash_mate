import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { enrollGroupClass } from '../api/coaching-api';

export function useEnrollGroupClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupClassId: string) => enrollGroupClass(groupClassId),
    onSuccess: (_data, groupClassId) => {
      message.success('报名成功');
      queryClient.invalidateQueries({ queryKey: ['group-class', groupClassId] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_GROUP_CLASS_NOT_FOUND':
          message.error('团课不存在');
          break;
        case 'COACHING_CLASS_FULL':
          message.error('团课已满员');
          break;
        case 'COACHING_ALREADY_ENROLLED':
          message.error('你已报名该团课');
          break;
        case 'COACHING_CLASS_NOT_ENROLLABLE':
          message.error('团课当前状态不可报名');
          break;
        case 'COACHING_CANNOT_ENROLL_OWN_CLASS':
          message.error('教练不可报名自己的团课');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
