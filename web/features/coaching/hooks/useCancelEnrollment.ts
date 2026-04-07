import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { cancelEnrollment } from '../api/coaching-api';

export function useCancelEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupClassId: string) => cancelEnrollment(groupClassId),
    onSuccess: (_data, groupClassId) => {
      message.success('已取消报名');
      queryClient.invalidateQueries({ queryKey: ['group-class', groupClassId] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_GROUP_CLASS_NOT_FOUND':
          message.error('团课不存在');
          break;
        case 'COACHING_NOT_ENROLLED':
          message.error('你未报名该团课');
          break;
        case 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT':
          message.error('团课当前状态不可取消报名');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
