export class MatchRecordRepository {
  async create(_data: unknown) {
    throw new Error('Not implemented');
  }

  async findById(_id: string) {
    throw new Error('Not implemented');
  }

  async deleteById(_id: string) {
    throw new Error('Not implemented');
  }

  async findBySource(_sourceType: string, _sourceId: string, _query: unknown) {
    throw new Error('Not implemented');
  }

  async findByUser(_userId: string, _query: unknown) {
    throw new Error('Not implemented');
  }

  async getUserMatchStats(_userId: string) {
    throw new Error('Not implemented');
  }

  async createGuestPlayer(_nickname: string) {
    throw new Error('Not implemented');
  }
}
