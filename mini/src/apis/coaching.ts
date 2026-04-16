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

// ---------------------------------------------------------------------------
// 团课详情相关
// ---------------------------------------------------------------------------

export interface GroupClassEnrollment {
  userId: string
  nickname: string
  avatarUrl: string | null
  enrolledAt: string
}

export interface GroupClassDetail {
  id: string
  coachId: string
  coach: { id: string; nickname: string; avatarUrl: string | null }
  title: string
  venue: { id: string; name: string; address: string } | null
  startTime: string
  endTime: string
  maxParticipants: number
  currentParticipants: number
  feeDescription: string | null
  status: 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled'
  enrollments: GroupClassEnrollment[]
  createdAt: string
}

/** 获取团课详情 */
export function getGroupClassDetail(id: string): Promise<GroupClassDetail> {
  return request<GroupClassDetail>({ url: `/group-classes/${id}` })
}

/** 报名团课 */
export function enrollGroupClass(id: string): Promise<void> {
  return request<void>({ url: `/group-classes/${id}/enroll`, method: 'POST' })
}

/** 取消报名团课 */
export function cancelEnrollment(id: string): Promise<void> {
  return request<void>({ url: `/group-classes/${id}/cancel-enrollment`, method: 'POST' })
}

// ---------------------------------------------------------------------------
// 私教详情相关
// ---------------------------------------------------------------------------

export interface PrivateLessonDetail {
  id: string
  coachId: string
  studentId: string | null
  venueId: string | null
  venueIds: string[]
  venue: SlotVenue | null
  startTime: string
  endTime: string
  feeDescription: string | null
  trainingContent: string | null
  source: 'booked' | 'scheduled' | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'expired'
  createdAt: string
  updatedAt: string
}

/** 获取私教课详情 */
export function getPrivateLessonDetail(id: string): Promise<PrivateLessonDetail> {
  return request<PrivateLessonDetail>({ url: `/private-lessons/${id}` })
}

/** 预约私教课（空闲时段） */
export function bookPrivateLesson(id: string, venueId?: string): Promise<void> {
  return request<void>({
    url: `/private-lessons/${id}/book`,
    method: 'POST',
    data: venueId ? { venueId } : undefined,
  })
}

/** 取消私教课 */
export function cancelPrivateLesson(id: string): Promise<void> {
  return request<void>({ url: `/private-lessons/${id}/cancel`, method: 'POST' })
}

/** 获取场馆详情 */
export function getVenueDetail(id: string): Promise<SlotVenue> {
  return request<SlotVenue>({ url: `/venues/${id}` })
}
