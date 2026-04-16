import { request } from './client'

export interface SubmitReviewInput {
  coachId: string
  rating: number // 1-5
  comment?: string // 0-500 字
  courseType: 'group-class' | 'private-lesson'
  courseId: string
}

export interface SubmitReviewResult {
  id: string
  reviewerId: string
  coachId: string
  courseType: string
  courseId: string
  rating: number
  comment: string | null
  createdAt: string
}

/** 提交教练评价 */
export function submitReview(data: SubmitReviewInput): Promise<SubmitReviewResult> {
  return request<SubmitReviewResult>({
    url: '/reviews',
    method: 'POST',
    data: data as Record<string, unknown>,
  })
}
