export class VenueRepository {
  async findVenueById(_id: string) {
    throw new Error('Not implemented');
  }

  async searchVenues(_query: unknown) {
    throw new Error('Not implemented');
  }

  async createCity(_name: string) {
    throw new Error('Not implemented');
  }

  async findCityByName(_name: string) {
    throw new Error('Not implemented');
  }

  async findCities(_query: unknown) {
    throw new Error('Not implemented');
  }

  async findAdminVenues(_query: unknown) {
    throw new Error('Not implemented');
  }

  async deleteVenue(_id: string) {
    throw new Error('Not implemented');
  }

  async upsertVenues(_cityId: string, _venues: unknown[]) {
    throw new Error('Not implemented');
  }

  async getAllCities() {
    throw new Error('Not implemented');
  }
}
