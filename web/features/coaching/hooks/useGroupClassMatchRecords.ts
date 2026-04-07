import { useQuery } from '@tanstack/react-query';
import { getSourceMatchRecords } from '../../match-record/api/match-record-api';

export function useGroupClassMatchRecords(
  groupClassId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['group-class-match-records', groupClassId],
    queryFn: () => getSourceMatchRecords('group-class', groupClassId, {}),
    enabled: options.enabled !== undefined ? options.enabled && !!groupClassId : !!groupClassId,
    staleTime: 30 * 1000,
  });
}
