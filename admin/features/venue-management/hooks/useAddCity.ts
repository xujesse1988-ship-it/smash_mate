import { message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCity } from '../api/venue-management-api';

export function useAddCity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createCity(name),
    onSuccess: (result) => {
      message.success(`城市「${result.name}」添加成功，球馆数据正在后台获取中`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cities'] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      // Error handling is done at the page level for form validation errors
      if (error.code !== 'VENUE_CITY_DUPLICATE' && error.code !== 'VENUE_INVALID_CITY_NAME') {
        message.error(error.message || '添加失败，请重试');
      }
    },
  });
}
