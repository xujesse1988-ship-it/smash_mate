import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { updateStudentClass } from '../api/student-class-api';

export function useUpdateStudentClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { classId: string; name: string }) =>
      updateStudentClass(params.classId, { name: params.name }),
    onSuccess: () => {
      message.success('班级名称已更新');
      queryClient.invalidateQueries({ queryKey: ['student-classes'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_INVALID_CLASS_NAME':
          message.error('班级名称需要 2-30 个字符');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
