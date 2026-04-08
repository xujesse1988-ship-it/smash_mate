import { useQuery } from '@tanstack/react-query';
import { getCities } from '../api/venue-management-api';

export function useCityList(params?: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['admin', 'cities', params?.page, params?.pageSize],
    queryFn: () => getCities({ page: params?.page, pageSize: params?.pageSize }),
  });
}
