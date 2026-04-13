import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { setStudentTags } from '../api/student-class-api';

export function useSetStudentTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      classId: string;
      studentId: string;
      tags: string[];
    }) => setStudentTags(params.classId, params.studentId, params.tags),
    onSuccess: (_data, variables) => {
      message.success('标签已更新');
      queryClient.invalidateQueries({
        queryKey: [
          'student-classes',
          variables.classId,
          'members',
          variables.studentId,
          'tags',
        ],
      });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_INVALID_TAGS':
          message.error('标签数量不能超过 10 个，每个不超过 20 字符');
          break;
        default:
          message.error(error.message || '更新失败，请重试');
      }
    },
  });
}
