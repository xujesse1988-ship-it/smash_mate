import {
  resolveUrl,
  getAdminAuthHeaders,
  handleResponse,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface City {
  id: string;
  name: string;
  venueCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminVenue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  cityId: string;
  cityName: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface SyncResult {
  cityId: string;
  cityName: string;
  newVenues: number;
  updatedVenues: number;
  totalVenues: number;
}

interface SyncResponse {
  message: string;
  syncResults: SyncResult[];
}

interface CreateCityResponse {
  id: string;
  name: string;
  venueCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function getCities(params: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<City>> {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }

  const queryString = searchParams.toString();
  const url = resolveUrl(
    `/api/admin/cities${queryString ? `?${queryString}` : ''}`,
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });

  return handleResponse<PaginatedResponse<City>>(response);
}

export async function createCity(name: string): Promise<CreateCityResponse> {
  const response = await fetch(resolveUrl('/api/admin/cities'), {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ name }),
  });

  return handleResponse<CreateCityResponse>(response);
}

export async function getAdminVenues(params: {
  cityId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<AdminVenue>> {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  if (params.cityId !== undefined) {
    searchParams.set('cityId', params.cityId);
  }
  if (params.keyword !== undefined) {
    searchParams.set('keyword', params.keyword);
  }

  const queryString = searchParams.toString();
  const url = resolveUrl(
    `/api/admin/venues${queryString ? `?${queryString}` : ''}`,
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });

  return handleResponse<PaginatedResponse<AdminVenue>>(response);
}

export async function deleteVenue(
  id: string,
): Promise<{ message: string }> {
  const response = await fetch(resolveUrl(`/api/admin/venues/${id}`), {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });

  return handleResponse<{ message: string }>(response);
}

export async function syncVenues(): Promise<SyncResponse> {
  const response = await fetch(resolveUrl('/api/admin/venues/sync'), {
    method: 'POST',
    headers: getAdminAuthHeaders(),
  });

  return handleResponse<SyncResponse>(response);
}
