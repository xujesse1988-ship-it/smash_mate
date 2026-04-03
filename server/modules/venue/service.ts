import type {
  VenueSearchQuery,
  CreateCityInput,
  AdminVenueListQuery,
  AdminCityListQuery,
  VenueInfo,
} from './types.js';

export class VenueService {
  async searchVenues(_query: VenueSearchQuery) {
    throw new Error('Not implemented');
  }

  async getVenueDetail(_id: string) {
    throw new Error('Not implemented');
  }

  async createCity(_input: CreateCityInput) {
    throw new Error('Not implemented');
  }

  async getCityList(_query: AdminCityListQuery) {
    throw new Error('Not implemented');
  }

  async getAdminVenueList(_query: AdminVenueListQuery) {
    throw new Error('Not implemented');
  }

  async deleteVenue(_id: string) {
    throw new Error('Not implemented');
  }

  async syncVenues() {
    throw new Error('Not implemented');
  }

  // --- Cross-module service methods ---

  async getVenueById(_id: string): Promise<VenueInfo | null> {
    throw new Error('Not implemented');
  }
}
