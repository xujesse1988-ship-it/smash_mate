import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { cancelPrivateLesson } from '../api/coaching-api';

export function useCancelPrivateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelPrivateLesson(id),
    onSuccess: () => {
      message.success('私教预约已取消');
      queryClient.invalidateQueries({ queryKey: ['coach-availability'] });
      queryClient.invalidateQueries({ queryKey: ['coach-private-lessons'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_PRIVATE_LESSON_NOT_FOUND':
          message.error('私教课不存在');
          break;
        case 'COACHING_NOT_LESSON_PARTICIPANT':
          message.error('无权取消此私教课');
          break;
        case 'COACHING_LESSON_NOT_CANCELLABLE':
          message.error('私教课当前状态不可取消');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
