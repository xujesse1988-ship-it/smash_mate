import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { cancelClassLesson } from '../api/student-class-api';

export function useCancelClassLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { classId: string; lessonId: string }) =>
      cancelClassLesson(params.classId, params.lessonId),
    onSuccess: (_data, variables) => {
      message.success('课程已取消');
      queryClient.invalidateQueries({
        queryKey: ['student-classes', variables.classId, 'lessons'],
      });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_LESSON_NOT_CANCELLABLE':
          message.error('该课程不可取消');
          break;
        default:
          message.error(error.message || '取消失败，请重试');
      }
    },
  });
}
