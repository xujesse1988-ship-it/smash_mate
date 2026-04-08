import { useQuery } from '@tanstack/react-query';
import { getActivityDetail } from '../../activity/api/activity-api';
import { getGroupClassDetail } from '../../coaching/api/coaching-api';

interface Participant {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
}

export function useSourceParticipants(
  sourceType: string | null,
  sourceId: string | null,
) {
  const activityQuery = useQuery({
    queryKey: ['activity', sourceId],
    queryFn: () => getActivityDetail(sourceId!),
    enabled: sourceType === 'activity' && !!sourceId,
    staleTime: 30 * 1000,
  });

  const groupClassQuery = useQuery({
    queryKey: ['group-class', sourceId],
    queryFn: () => getGroupClassDetail(sourceId!),
    enabled: sourceType === 'group-class' && !!sourceId,
    staleTime: 30 * 1000,
  });

  if (sourceType === 'activity') {
    const participants: Participant[] = (activityQuery.data?.participants ?? []).map(
      (p) => ({
        userId: p.userId,
        nickname: p.nickname,
        avatarUrl: p.avatarUrl,
      }),
    );
    return {
      participants,
      isLoading: activityQuery.isLoading,
      error: activityQuery.error,
    };
  }

  if (sourceType === 'group-class') {
    const participants: Participant[] = (groupClassQuery.data?.enrollments ?? []).map(
      (e) => ({
        userId: e.userId,
        nickname: e.nickname,
        avatarUrl: e.avatarUrl,
      }),
    );
    return {
      participants,
      isLoading: groupClassQuery.isLoading,
      error: groupClassQuery.error,
    };
  }

  // private-lesson or unknown: return empty array
  return {
    participants: [] as Participant[],
    isLoading: false,
    error: null,
  };
}
