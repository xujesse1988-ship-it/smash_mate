import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createActivity } from '../api/activity-api';

interface CreateActivityParams {
  venueId: string;
  title?: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (params: CreateActivityParams) => createActivity(params),
    onSuccess: (data) => {
      message.success('发布成功');
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      navigate(`/activities/${data.id}`);
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'ACTIVITY_INVALID_VENUE':
          message.error('请选择球馆');
          break;
        case 'ACTIVITY_INVALID_TIME':
          message.error(
            '开始时间必须晚于当前时间，结束时间必须晚于开始时间',
          );
          break;
        case 'ACTIVITY_INVALID_PARTICIPANTS':
          message.error('限定人数需在 2-50 之间');
          break;
        case 'ACTIVITY_INVALID_TITLE':
          message.error('标题不能超过 50 个字符');
          break;
        case 'ACTIVITY_VENUE_NOT_FOUND':
          message.error('选择的球馆不存在，请重新选择');
          break;
        default:
          message.error(error.message || '发布失败，请重试');
      }
    },
  });
}
