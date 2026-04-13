import { useQuery } from '@tanstack/react-query';
import { getStudentTags } from '../api/student-class-api';

export function useStudentTags(classId: string, studentId: string) {
  return useQuery({
    queryKey: ['student-classes', classId, 'members', studentId, 'tags'],
    queryFn: () => getStudentTags(classId, studentId),
    enabled: !!classId && !!studentId,
    staleTime: 30 * 1000,
  });
}
