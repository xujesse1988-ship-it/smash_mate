import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { cancelGroupClass } from '../api/coaching-api';

export function useCancelGroupClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelGroupClass(id),
    onSuccess: () => {
      message.success('团课已取消');
      queryClient.invalidateQueries({ queryKey: ['coach'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_NOT_COACH_OWNER':
          message.error('无权取消此团课');
          break;
        case 'COACHING_GROUP_CLASS_NOT_FOUND':
          message.error('团课不存在');
          break;
        case 'COACHING_CLASS_NOT_CANCELLABLE':
          message.error('团课当前状态不可取消');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
