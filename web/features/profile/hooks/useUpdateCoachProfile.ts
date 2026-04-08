import { useMutation } from '@tanstack/react-query';
import { updateCoachProfile, type CoachSpecialty } from '../api/profile-api';

export function useUpdateCoachProfile() {
  return useMutation({
    mutationFn: (data: { bio?: string; specialties?: CoachSpecialty[] }) =>
      updateCoachProfile(data),
  });
}
