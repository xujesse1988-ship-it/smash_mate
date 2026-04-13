import { useQuery } from '@tanstack/react-query';
import { getStudentClassDetail } from '../api/student-class-api';

export function useStudentClassDetail(classId: string) {
  return useQuery({
    queryKey: ['student-classes', classId],
    queryFn: () => getStudentClassDetail(classId),
    enabled: !!classId,
    staleTime: 30 * 1000,
  });
}
