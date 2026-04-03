export class NotificationRepository {
  async create(_data: unknown) {
    throw new Error('Not implemented');
  }

  async createMany(_data: unknown[]) {
    throw new Error('Not implemented');
  }

  async findByUser(_userId: string, _query: unknown) {
    throw new Error('Not implemented');
  }

  async countUnread(_userId: string): Promise<number> {
    throw new Error('Not implemented');
  }

  async findById(_id: string) {
    throw new Error('Not implemented');
  }

  async markAsRead(_id: string) {
    throw new Error('Not implemented');
  }

  async markAllAsRead(_userId: string): Promise<number> {
    throw new Error('Not implemented');
  }

  async deleteExpired(_cutoffDate: Date): Promise<number> {
    throw new Error('Not implemented');
  }
}
