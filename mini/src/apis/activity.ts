import { request } from './client'
import type { PaginatedResult } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Venue {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
}

export interface ActivityListItem {
  id: string
  title: string | null
  startTime: string
  endTime: string
  maxParticipants: number
  currentParticipants: number
  status: 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled'
  venue: Venue | null
  creator: { id: string; nickname: string; avatarUrl: string | null }
  distance?: number
}

export interface GetActivitiesParams {
  page?: number
  pageSize?: number
  dateFilter?: 'today' | 'tomorrow' | 'this_week' | 'custom'
  startDate?: string
  endDate?: string
  hasSlots?: boolean
  latitude?: number
  longitude?: number
  sortBy?: 'time' | 'distance'
}

// ---------------------------------------------------------------------------
// GET /api/activities
// ---------------------------------------------------------------------------

/** 获取活动列表 */
export async function getActivities(
  params: GetActivitiesParams,
): Promise<PaginatedResult<ActivityListItem>> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.dateFilter) searchParams.set('dateFilter', params.dateFilter)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  if (params.hasSlots) searchParams.set('hasSlots', 'true')
  if (params.latitude !== undefined) searchParams.set('latitude', String(params.latitude))
  if (params.longitude !== undefined) searchParams.set('longitude', String(params.longitude))
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)

  const query = searchParams.toString()
  return request<PaginatedResult<ActivityListItem>>({
    url: `/activities${query ? `?${query}` : ''}`,
  })
}

// ---------------------------------------------------------------------------
// Activity Detail Types
// ---------------------------------------------------------------------------

export interface ActivityParticipant {
  id: string
  nickname: string
  avatarUrl: string | null
}

export interface ActivityDetail {
  id: string
  title: string | null
  startTime: string
  endTime: string
  maxParticipants: number
  currentParticipants: number
  status: 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled'
  venue: Venue | null
  creator: { id: string; nickname: string; avatarUrl: string | null }
  participants: ActivityParticipant[]
  isParticipant: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// GET /api/activities/:id
// ---------------------------------------------------------------------------

export function getActivityDetail(id: string): Promise<ActivityDetail> {
  return request<ActivityDetail>({ url: `/activities/${id}` })
}

// ---------------------------------------------------------------------------
// POST /api/activities/:id/join
// ---------------------------------------------------------------------------

export function joinActivity(id: string): Promise<void> {
  return request<void>({ url: `/activities/${id}/join`, method: 'POST' })
}

// ---------------------------------------------------------------------------
// POST /api/activities/:id/leave
// ---------------------------------------------------------------------------

export function leaveActivity(id: string): Promise<void> {
  return request<void>({ url: `/activities/${id}/leave`, method: 'POST' })
}

// ---------------------------------------------------------------------------
// POST /api/activities/:id/cancel
// ---------------------------------------------------------------------------

export function cancelActivity(id: string): Promise<void> {
  return request<void>({ url: `/activities/${id}/cancel`, method: 'POST' })
}

// ---------------------------------------------------------------------------
// POST /api/activities
// ---------------------------------------------------------------------------

export interface CreateActivityInput {
  venueId?: string
  title?: string
  startTime: string
  endTime: string
  maxParticipants: number
}

export function createActivity(data: CreateActivityInput): Promise<ActivityDetail> {
  return request<ActivityDetail>({ url: '/activities', method: 'POST', data: data as Record<string, unknown> })
}
