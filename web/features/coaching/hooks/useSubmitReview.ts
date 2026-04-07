import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { createReview } from '../api/review-api';

export function useSubmitReview(coachId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      coachId: string;
      courseType: string;
      courseId: string;
      rating: number;
      comment?: string;
    }) => createReview(data),
    onSuccess: () => {
      message.success('评价提交成功');
      queryClient.invalidateQueries({ queryKey: ['coach-reviews', coachId] });
      queryClient.invalidateQueries({ queryKey: ['coach-rating', coachId] });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'REVIEW_COACH_NOT_FOUND':
          message.error('教练不存在');
          break;
        case 'REVIEW_COURSE_NOT_FOUND':
          message.error('课程不存在');
          break;
        case 'REVIEW_COURSE_NOT_COMPLETED':
          message.error('课程尚未结束，暂不可评价');
          break;
        case 'REVIEW_NOT_PARTICIPANT':
          message.error('仅参加过该课程的学员可以评价');
          break;
        case 'REVIEW_CANNOT_REVIEW_SELF':
          message.error('不能评价自己');
          break;
        case 'REVIEW_DUPLICATE':
          message.error('你已经评价过此课程');
          break;
        case 'REVIEW_COURSE_COACH_MISMATCH':
          message.error('课程与教练不匹配');
          break;
        default:
          message.error(error.message || '评价提交失败，请重试');
      }
    },
  });
}
