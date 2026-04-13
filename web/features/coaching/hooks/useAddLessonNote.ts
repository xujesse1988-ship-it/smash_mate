import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { addLessonNote } from '../api/student-class-api';

export function useAddLessonNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      classId: string;
      lessonId: string;
      content: string;
    }) => addLessonNote(params.classId, params.lessonId, params.content),
    onSuccess: (_data, variables) => {
      message.success('笔记已添加');
      queryClient.invalidateQueries({
        queryKey: [
          'student-classes',
          variables.classId,
          'lessons',
          variables.lessonId,
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
        case 'COACHING_LESSON_CANCELLED':
          message.error('课程已取消，不可添加笔记');
          break;
        default:
          message.error(error.message || '添加失败，请重试');
      }
    },
  });
}
