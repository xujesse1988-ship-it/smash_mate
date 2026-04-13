import { useQuery } from '@tanstack/react-query';
import { getClassLessonDetail } from '../api/student-class-api';

export function useClassLessonDetail(classId: string, lessonId: string) {
  return useQuery({
    queryKey: ['student-classes', classId, 'lessons', lessonId],
    queryFn: () => getClassLessonDetail(classId, lessonId),
    enabled: !!classId && !!lessonId,
    staleTime: 30 * 1000,
  });
}
