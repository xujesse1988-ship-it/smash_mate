import { useMutation } from '@tanstack/react-query';
import { updateCoachProfile } from '../api/profile-api';

export function useUpdateCoachProfile() {
  return useMutation({
    mutationFn: (data: { bio?: string; specialties?: string[] }) =>
      updateCoachProfile(data),
  });
}
