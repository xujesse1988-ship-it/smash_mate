export interface VenueSearchQuery {
  keyword: string;
  latitude?: number;
  longitude?: number;
  limit?: number;
}

export interface CreateCityInput {
  name: string;
}

export interface AdminVenueListQuery {
  cityId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminCityListQuery {
  page?: number;
  pageSize?: number;
}

export interface VenueInfo {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SyncResult {
  cityId: string;
  cityName: string;
  newVenues: number;
  updatedVenues: number;
  totalVenues: number;
}
