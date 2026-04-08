import { useQuery } from '@tanstack/react-query';
import { getCoachProfile } from '../api/profile-api';

export function useCoachProfile(coachId: string) {
  return useQuery({
    queryKey: ['coach-profile-edit', coachId],
    queryFn: async () => {
      try {
        const profile = await getCoachProfile(coachId);
        return {
          bio: profile.bio,
          specialties: profile.specialties,
        };
      } catch (error) {
        const err = error as Error & { code?: string };
        // COACHING_NOT_A_COACH means coach profile doesn't exist yet (first-time edit)
        if (err.code === 'COACHING_NOT_A_COACH') {
          return null;
        }
        throw error;
      }
    },
    enabled: !!coachId,
    staleTime: 30 * 1000,
  });
}
