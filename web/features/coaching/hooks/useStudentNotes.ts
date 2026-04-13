import { useQuery } from '@tanstack/react-query';
import { getStudentNotes } from '../api/student-class-api';

export function useStudentNotes(classId: string, studentId: string) {
  return useQuery({
    queryKey: ['student-classes', classId, 'members', studentId, 'notes'],
    queryFn: () => getStudentNotes(classId, studentId),
    enabled: !!classId && !!studentId,
    staleTime: 30 * 1000,
  });
}
