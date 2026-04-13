import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { updateTrainingContent } from '../api/student-class-api';

export function useUpdateTrainingContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      classId: string;
      lessonId: string;
      content: string;
    }) => updateTrainingContent(params.classId, params.lessonId, params.content),
    onSuccess: (_data, variables) => {
      message.success('训练内容已更新');
      queryClient.invalidateQueries({
        queryKey: ['student-classes', variables.classId, 'lessons', variables.lessonId],
      });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_INVALID_TRAINING_CONTENT':
          message.error('训练内容不能超过 2000 字符');
          break;
        case 'COACHING_LESSON_CANCELLED':
          message.error('课程已取消，不可修改');
          break;
        default:
          message.error(error.message || '更新失败，请重试');
      }
    },
  });
}
