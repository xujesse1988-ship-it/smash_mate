import { useQuery } from '@tanstack/react-query';
import { getClassLessons } from '../api/student-class-api';

export function useClassLessons(classId: string, params?: { status?: string }) {
  return useQuery({
    queryKey: ['student-classes', classId, 'lessons', params],
    queryFn: () => getClassLessons(classId, params),
    enabled: !!classId,
    staleTime: 30 * 1000,
  });
}
