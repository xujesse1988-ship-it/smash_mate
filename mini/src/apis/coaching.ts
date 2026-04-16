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
