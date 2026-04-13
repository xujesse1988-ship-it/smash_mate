import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { createStudentClass } from '../api/student-class-api';

export function useCreateStudentClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string }) => createStudentClass(data),
    onSuccess: () => {
      message.success('学员班创建成功');
      queryClient.invalidateQueries({ queryKey: ['student-classes'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_INVALID_CLASS_NAME':
          message.error('班级名称需要 2-30 个字符');
          break;
        case 'COACHING_COACH_ROLE_REQUIRED':
          message.error('请先开启教练角色');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
