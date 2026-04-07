import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { bookPrivateLesson } from '../api/coaching-api';

export function useBookPrivateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { slotId: string; venueId?: string }) =>
      bookPrivateLesson(data),
    onSuccess: () => {
      message.success('预约成功');
      queryClient.invalidateQueries({ queryKey: ['coach-availability'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_SLOT_NOT_FOUND':
          message.error('时间段不存在');
          break;
        case 'COACHING_SLOT_ALREADY_BOOKED':
          message.error('该时间段已被预约');
          break;
        case 'COACHING_SLOT_EXPIRED':
          message.error('该时间段已过期');
          break;
        case 'COACHING_VENUE_REQUIRED':
          message.error('请选择上课地点');
          break;
        case 'COACHING_INVALID_VENUE_CHOICE':
          message.error('选择的球馆不在可选范围内');
          break;
        case 'COACHING_VENUE_NOT_FOUND':
          message.error('球馆不存在');
          break;
        case 'COACHING_CANNOT_BOOK_OWN_LESSON':
          message.error('不能预约自己的私教课');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
