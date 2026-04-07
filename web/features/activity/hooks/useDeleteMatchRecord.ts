import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';

function resolveUrl(path: string): string {
  if (typeof globalThis.location !== 'undefined') {
    return path;
  }
  return `http://localhost${path}`;
}

async function deleteMatchRecord(recordId: string): Promise<void> {
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(resolveUrl(`/api/match-records/${recordId}`), {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const body = await response.json();
    const error = body.error as { code: string; message: string };
    const err = new Error(error.message) as Error & { code: string };
    err.code = error.code;
    throw err;
  }
}

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
