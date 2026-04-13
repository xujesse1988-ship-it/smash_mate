import { useQuery } from '@tanstack/react-query';
import { getApplicationDetail } from '../api/coach-review-api';

export function useApplicationDetail(id: string) {
  return useQuery({
    queryKey: ['coach-application', id],
    queryFn: () => getApplicationDetail(id),
    enabled: !!id,
    staleTime: 10 * 1000,
  });
}
