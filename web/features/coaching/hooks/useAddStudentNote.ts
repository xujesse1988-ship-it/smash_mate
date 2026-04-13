import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { addStudentNote } from '../api/student-class-api';

export function useAddStudentNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      classId: string;
      studentId: string;
      content: string;
    }) => addStudentNote(params.classId, params.studentId, params.content),
    onSuccess: (_data, variables) => {
      message.success('笔记已添加');
      queryClient.invalidateQueries({
        queryKey: [
          'student-classes',
          variables.classId,
          'members',
          variables.studentId,
          'notes',
        ],
      });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'COACHING_INVALID_NOTE_CONTENT':
          message.error('笔记内容不能为空且不超过 500 字符');
          break;
        default:
          message.error(error.message || '添加失败，请重试');
      }
    },
  });
}
