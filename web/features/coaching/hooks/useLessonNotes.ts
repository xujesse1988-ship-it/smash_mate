import { useQuery } from '@tanstack/react-query';
import { getLessonNotes } from '../api/student-class-api';

export function useLessonNotes(classId: string, lessonId: string) {
  return useQuery({
    queryKey: ['student-classes', classId, 'lessons', lessonId, 'notes'],
    queryFn: () => getLessonNotes(classId, lessonId),
    enabled: !!classId && !!lessonId,
    staleTime: 30 * 1000,
  });
}
