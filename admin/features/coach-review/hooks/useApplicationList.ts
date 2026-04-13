import { useQuery } from '@tanstack/react-query';
import { getApplicationList } from '../api/coach-review-api';

export function useApplicationList(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['coach-applications', params],
    queryFn: () => getApplicationList(params),
    staleTime: 10 * 1000,
  });
}
