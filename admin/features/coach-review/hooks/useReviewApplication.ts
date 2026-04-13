import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewApplication } from '../api/coach-review-api';

export function useReviewApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { status: 'approved' | 'rejected'; rejectReason?: string };
    }) => reviewApplication(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-applications'] });
      queryClient.invalidateQueries({ queryKey: ['coach-application'] });
    },
  });
}
