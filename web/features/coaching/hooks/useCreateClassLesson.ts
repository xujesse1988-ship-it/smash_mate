import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { createClassLesson } from '../api/student-class-api';

export function useCreateClassLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      classId: string;
      data: {
        startTime: string;
        endTime: string;
        venueId: string;
        trainingContent?: string;
      };
    }) => createClassLesson(params.classId, params.data),
    onSuccess: (_data, variables) => {
      message.success('课程已创建');
      queryClient.invalidateQueries({
        queryKey: ['student-classes', variables.classId, 'lessons'],
      });
      queryClient.invalidateQueries({
        queryKey: ['student-classes', variables.classId],
      });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_INVALID_TIME':
          message.error('开始时间必须晚于当前，结束时间必须晚于开始时间');
          break;
        case 'COACHING_VENUE_NOT_FOUND':
          message.error('球馆不存在，请重新选择');
          break;
        default:
          message.error(error.message || '创建失败，请重试');
      }
    },
  });
}
