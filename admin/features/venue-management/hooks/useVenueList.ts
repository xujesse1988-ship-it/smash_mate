import { useQuery } from '@tanstack/react-query';
import { getAdminVenues } from '../api/venue-management-api';

export function useVenueList(params?: {
  cityId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: [
      'admin',
      'venues',
      params?.cityId,
      params?.keyword,
      params?.page,
      params?.pageSize,
    ],
    queryFn: () =>
      getAdminVenues({
        cityId: params?.cityId,
        keyword: params?.keyword,
        page: params?.page,
        pageSize: params?.pageSize,
      }),
  });
}
