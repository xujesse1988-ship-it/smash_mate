import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createMatchRecord } from '../api/match-record-api';

export function useCreateMatchRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMatchRecord,
    onSuccess: (_data, variables) => {
      // Invalidate relevant caches
      if (variables.sourceType === 'activity') {
        queryClient.invalidateQueries({
          queryKey: ['activity-match-records', variables.sourceId],
        });
      }
      if (variables.sourceType === 'group-class') {
        queryClient.invalidateQueries({
          queryKey: ['groupClass', variables.sourceId, 'matchRecords'],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['user-match-records'] });
      queryClient.invalidateQueries({ queryKey: ['user-match-stats'] });
    },
  });
}
