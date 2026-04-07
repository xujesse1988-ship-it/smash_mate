import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { deleteMatchRecord } from '../api/activity-api';

export function useDeleteMatchRecord(activityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => deleteMatchRecord(recordId),
    onSuccess: () => {
      message.success('战绩已删除');
      queryClient.invalidateQueries({
        queryKey: ['activity-match-records', activityId],
      });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'MATCH_RECORD_NOT_RECORDER':
          message.error('只能删除自己录入的战绩');
          break;
        case 'MATCH_RECORD_NOT_FOUND':
          message.error('战绩不存在');
          break;
        default:
          message.error(error.message || '操作失败，请重试');
      }
    },
  });
}
