export class ActivityRepository {
  async create(_data: unknown) {
    throw new Error('Not implemented');
  }

  async findById(_id: string) {
    throw new Error('Not implemented');
  }

  async findList(_query: unknown) {
    throw new Error('Not implemented');
  }

  async addParticipant(_activityId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async removeParticipant(_activityId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async update(_id: string, _data: unknown) {
    throw new Error('Not implemented');
  }

  async updateStatus(_id: string, _status: string) {
    throw new Error('Not implemented');
  }

  async findUserActivities(_userId: string, _query: unknown) {
    throw new Error('Not implemented');
  }

  async findActivitiesToTransition(_fromStatus: string, _timeField: string, _now: Date) {
    throw new Error('Not implemented');
  }

  async getParticipantIds(_activityId: string): Promise<string[]> {
    throw new Error('Not implemented');
  }
}
