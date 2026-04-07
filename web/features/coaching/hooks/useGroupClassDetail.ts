import { useQuery } from '@tanstack/react-query';
import { getGroupClassDetail } from '../api/coaching-api';

export function useGroupClassDetail(groupClassId: string) {
  return useQuery({
    queryKey: ['group-class', groupClassId],
    queryFn: () => getGroupClassDetail(groupClassId),
    enabled: !!groupClassId,
    staleTime: 30 * 1000,
  });
}
