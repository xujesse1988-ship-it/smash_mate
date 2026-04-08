import { resolveUrl, handleResponse, getAuthHeaders } from '../../../shared/utils/api-client';

export interface VenueSearchItem {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export async function searchVenues(params: {
  keyword: string;
  latitude?: number;
  longitude?: number;
  limit?: number;
}): Promise<{ items: VenueSearchItem[] }> {
  const searchParams = new URLSearchParams();

  searchParams.set('keyword', params.keyword);
  if (params.latitude !== undefined) {
    searchParams.set('latitude', String(params.latitude));
  }
  if (params.longitude !== undefined) {
    searchParams.set('longitude', String(params.longitude));
  }
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  const response = await fetch(resolveUrl(`/api/venues/search?${searchParams.toString()}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<{ items: VenueSearchItem[] }>(response);
}

export async function getVenueDetail(id: string): Promise<VenueSearchItem> {
  const response = await fetch(resolveUrl(`/api/venues/${id}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<VenueSearchItem>(response);
}
