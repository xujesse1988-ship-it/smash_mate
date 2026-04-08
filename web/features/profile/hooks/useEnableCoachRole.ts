import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enableCoachRole } from '../api/profile-api';

export function useEnableCoachRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: enableCoachRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });
}
