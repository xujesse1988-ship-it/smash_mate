import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { deleteStudentClass } from '../api/student-class-api';

export function useDeleteStudentClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (classId: string) => deleteStudentClass(classId),
    onSuccess: () => {
      message.success('学员班已删除');
      queryClient.invalidateQueries({ queryKey: ['student-classes'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      message.error(error.message || '删除失败，请重试');
    },
  });
}
