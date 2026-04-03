export class CoachingRepository {
  async findCoachProfile(_userId: string) {
    throw new Error('Not implemented');
  }

  async createCoachProfile(_userId: string) {
    throw new Error('Not implemented');
  }

  async updateCoachProfile(_userId: string, _data: unknown) {
    throw new Error('Not implemented');
  }

  async findCoachList(_query: unknown) {
    throw new Error('Not implemented');
  }

  async createGroupClass(_data: unknown) {
    throw new Error('Not implemented');
  }

  async findGroupClassById(_id: string) {
    throw new Error('Not implemented');
  }

  async updateGroupClass(_id: string, _data: unknown) {
    throw new Error('Not implemented');
  }

  async enrollGroupClass(_classId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async cancelEnrollment(_classId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async createPrivateLessonSlot(_data: unknown) {
    throw new Error('Not implemented');
  }

  async findAvailability(_coachId: string) {
    throw new Error('Not implemented');
  }

  async bookPrivateLesson(_data: unknown) {
    throw new Error('Not implemented');
  }

  async cancelPrivateLesson(_id: string) {
    throw new Error('Not implemented');
  }

  async findPrivateLessonById(_id: string) {
    throw new Error('Not implemented');
  }

  async findUserEnrollments(_userId: string, _query: unknown) {
    throw new Error('Not implemented');
  }

  async findCoachPrivateLessons(_coachId: string, _query: unknown) {
    throw new Error('Not implemented');
  }

  async getGroupClassParticipantIds(_classId: string): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async getPrivateLessonParticipantIds(_lessonId: string): Promise<string[]> {
    throw new Error('Not implemented');
  }
}
