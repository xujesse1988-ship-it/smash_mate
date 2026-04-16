import { request } from './client'
import type { PaginatedResult } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VenueSearchItem {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  distance?: number
}

export interface SearchVenuesParams {
  keyword?: string
  latitude?: number
  longitude?: number
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// GET /api/venues/search
// ---------------------------------------------------------------------------

export async function searchVenues(
  params: SearchVenuesParams,
): Promise<PaginatedResult<VenueSearchItem>> {
  const searchParams = new URLSearchParams()
  if (params.keyword) searchParams.set('keyword', params.keyword)
  if (params.latitude !== undefined) searchParams.set('latitude', String(params.latitude))
  if (params.longitude !== undefined) searchParams.set('longitude', String(params.longitude))
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  const query = searchParams.toString()
  return request<PaginatedResult<VenueSearchItem>>({
    url: `/venues/search${query ? `?${query}` : ''}`,
  })
}
