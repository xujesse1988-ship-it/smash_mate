import { useQuery } from '@tanstack/react-query';
import {
  getActivityMatchRecords,
  type MatchRecord,
} from '../api/activity-api';

export type { MatchRecord } from '../api/activity-api';

export function useActivityMatchRecords(activityId: string) {
  return useQuery<MatchRecord[]>({
    queryKey: ['activity-match-records', activityId],
    queryFn: () => getActivityMatchRecords(activityId),
    enabled: !!activityId,
    staleTime: 30 * 1000,
  });
}
