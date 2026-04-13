import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyApplicationStatus,
  submitCoachApplication,
  type SubmitCoachApplicationInput,
} from '../api/coach-application-api';

export function useCoachApplication() {
  return useQuery({
    queryKey: ['coach-application', 'me'],
    queryFn: getMyApplicationStatus,
    staleTime: 30 * 1000,
  });
}

export function useSubmitApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitCoachApplicationInput) =>
      submitCoachApplication(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-application', 'me'] });
    },
  });
}
