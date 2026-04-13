import { useQuery } from '@tanstack/react-query';
import { getStudentClasses } from '../api/student-class-api';

export function useStudentClasses() {
  return useQuery({
    queryKey: ['student-classes'],
    queryFn: () => getStudentClasses(),
    staleTime: 30 * 1000,
  });
}
