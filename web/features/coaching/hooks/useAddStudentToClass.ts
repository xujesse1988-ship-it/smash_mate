import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { addStudentToClass } from '../api/student-class-api';

export function useAddStudentToClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { classId: string; studentId: string }) =>
      addStudentToClass(params.classId, params.studentId),
    onSuccess: () => {
      message.success('学员已添加');
      queryClient.invalidateQueries({ queryKey: ['student-classes'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'USER_NOT_FOUND':
          message.error('用户不存在');
          break;
        case 'COACHING_STUDENT_ALREADY_IN_CLASS':
          message.error('该学员已在班级中');
          break;
        default:
          message.error(error.message || '添加失败，请重试');
      }
    },
  });
}
