export class UserRepository {
  async findByPhone(_phone: string) {
    throw new Error('Not implemented');
  }

  async findById(_id: string) {
    throw new Error('Not implemented');
  }

  async findByIds(_ids: string[]) {
    throw new Error('Not implemented');
  }

  async create(_data: { phone: string; nickname: string; isCoach: boolean }) {
    throw new Error('Not implemented');
  }

  async update(_id: string, _data: { nickname?: string; avatarUrl?: string; bio?: string }) {
    throw new Error('Not implemented');
  }

  async updateCoachRole(_id: string, _isCoach: boolean) {
    throw new Error('Not implemented');
  }

  async createVerificationCode(_data: { phone: string; code: string; expiresAt: Date }) {
    throw new Error('Not implemented');
  }

  async findLatestVerificationCode(_phone: string) {
    throw new Error('Not implemented');
  }

  async markVerificationCodeUsed(_id: string) {
    throw new Error('Not implemented');
  }

  async findOrCreatePhoneLock(_phone: string) {
    throw new Error('Not implemented');
  }

  async updatePhoneLock(_id: string, _data: { failCount: number; lockedUntil: Date | null }) {
    throw new Error('Not implemented');
  }
}
