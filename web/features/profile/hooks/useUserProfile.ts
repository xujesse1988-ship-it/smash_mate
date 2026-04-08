import { useQuery } from '@tanstack/react-query';
import { getUserPublicInfo } from '../api/profile-api';

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => getUserPublicInfo(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
