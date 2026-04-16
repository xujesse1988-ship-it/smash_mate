import { request } from './client'
import type { PaginatedResult } from './types'

export type Specialty = 'singles' | 'doubles' | 'footwork' | 'fitness' | 'tactics'

export interface CoachListItem {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  specialties: Specialty[]
  averageRating: number | null
  reviewCount: number
}

export interface GetCoachesParams {
  page?: number
  pageSize?: number
  specialty?: Specialty
}

/** 获取教练列表 */
export async function getCoaches(params: GetCoachesParams = {}): Promise<PaginatedResult<CoachListItem>> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.specialty) searchParams.set('specialty', params.specialty)
  const query = searchParams.toString()
  return request<PaginatedResult<CoachListItem>>({
    url: `/coaches${query ? `?${query}` : ''}`,
  })
}

// ---------------------------------------------------------------------------
// 教练详情相关
// ---------------------------------------------------------------------------

export interface SlotVenue {
  id: string
  name: string
  address: string
}

export interface CoachProfileGroupClass {
  id: string
  title: string
  startTime: string
  endTime: string
  venue: SlotVenue | null
  maxParticipants: number
  currentParticipants: number
  feeDescription: string | null
  status: string
}

export interface CoachProfileSlot {
  id: string
  startTime: string
  endTime: string
  venues: SlotVenue[]
  feeDescription: string | null
  isBooked: boolean
}

export interface CoachProfile {
  userId: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  specialties: string[]
  studentCount: number
  groupClasses: CoachProfileGroupClass[]
  privateLessonSlots: CoachProfileSlot[]
}

export interface CoachRating {
  coachId: string
  averageRating: number | null
  totalCount: number
}

export interface ReviewItem {
  id: string
  reviewer: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  courseType: string
  courseId: string
  rating: number
  comment: string | null
  createdAt: string
}

/** 获取教练详情 */
export function getCoachProfile(id: string): Promise<CoachProfile> {
  return request<CoachProfile>({ url: `/coaches/${id}` })
}

/** 获取教练评分 */
export function getCoachRating(coachId: string): Promise<CoachRating> {
  return request<CoachRating>({ url: `/coaches/${coachId}/rating` })
}

/** 获取教练评价列表 */
export function getCoachReviews(
  coachId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<ReviewItem>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
  const query = searchParams.toString()
  return request<PaginatedResult<ReviewItem>>({
    url: `/coaches/${coachId}/reviews${query ? `?${query}` : ''}`,
  })
}
