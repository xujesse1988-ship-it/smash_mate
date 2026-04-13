import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { removeStudentFromClass } from '../api/student-class-api';

export function useRemoveStudentFromClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { classId: string; studentId: string }) =>
      removeStudentFromClass(params.classId, params.studentId),
    onSuccess: () => {
      message.success('学员已移除');
      queryClient.invalidateQueries({ queryKey: ['student-classes'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      message.error(error.message || '移除失败，请重试');
    },
  });
}
