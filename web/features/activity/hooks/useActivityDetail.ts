import { useQuery } from '@tanstack/react-query';
import { getActivityDetail } from '../api/activity-api';

export function useActivityDetail(activityId: string) {
  return useQuery({
    queryKey: ['activity', activityId],
    queryFn: () => getActivityDetail(activityId),
    enabled: !!activityId,
    staleTime: 30 * 1000,
  });
}
