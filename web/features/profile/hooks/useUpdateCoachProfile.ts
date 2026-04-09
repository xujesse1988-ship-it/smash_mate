import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCoachProfile, type CoachSpecialty } from '../api/profile-api';

export function useUpdateCoachProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { bio?: string; specialties?: CoachSpecialty[] }) =>
      updateCoachProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-profile-edit'] });
      queryClient.invalidateQueries({ queryKey: ['coach'] });
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
    },
  });
}
