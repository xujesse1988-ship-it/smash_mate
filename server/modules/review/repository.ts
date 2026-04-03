export class ReviewRepository {
  async create(_data: unknown) {
    throw new Error('Not implemented');
  }

  async findByCoach(_coachId: string, _query: unknown) {
    throw new Error('Not implemented');
  }

  async findDuplicate(_reviewerId: string, _courseType: string, _courseId: string) {
    throw new Error('Not implemented');
  }

  async getCoachAverageRating(_coachId: string) {
    throw new Error('Not implemented');
  }

  async getCoachesAverageRatings(_coachIds: string[]) {
    throw new Error('Not implemented');
  }
}
