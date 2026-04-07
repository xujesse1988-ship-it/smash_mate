import { useInfiniteQuery } from '@tanstack/react-query';
import { getUserEnrollments, type PaginatedResult, type EnrollmentItem } from '../api/coaching-api';
import { useAuthStore } from '../../../stores/auth-store';

export function useMyEnrollments(params: {
  type?: string | null;
  status?: string | null;
} = {}) {
  const userId = useAuthStore((state) => state.userId);

  return useInfiniteQuery<PaginatedResult<EnrollmentItem>>({
    queryKey: ['my-enrollments', userId, { type: params.type, status: params.status }],
    queryFn: ({ pageParam }) => {
      const apiParams: { page?: number; pageSize?: number; type?: string; status?: string } = {
        page: pageParam as number,
        pageSize: 20,
      };
      if (params.type) apiParams.type = params.type;
      if (params.status) apiParams.status = params.status;
      return getUserEnrollments(userId!, apiParams);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
