import type {
  UpdateCoachProfileInput,
  CreateGroupClassInput,
  UpdateGroupClassInput,
  SetAvailabilityInput,
  BookPrivateLessonInput,
  CoachListQuery,
  PrivateLessonListQuery,
  EnrollmentListQuery,
} from './types.js';

export class CoachingService {
  async getCoachList(_query: CoachListQuery) {
    throw new Error('Not implemented');
  }

  async getCoachProfile(_coachId: string) {
    throw new Error('Not implemented');
  }

  async updateCoachProfile(_userId: string, _input: UpdateCoachProfileInput) {
    throw new Error('Not implemented');
  }

  async createGroupClass(_userId: string, _input: CreateGroupClassInput) {
    throw new Error('Not implemented');
  }

  async getGroupClassDetail(_id: string) {
    throw new Error('Not implemented');
  }

  async updateGroupClass(_classId: string, _userId: string, _input: UpdateGroupClassInput) {
    throw new Error('Not implemented');
  }

  async cancelGroupClass(_classId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async enrollGroupClass(_classId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async cancelEnrollment(_classId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async setAvailability(_userId: string, _input: SetAvailabilityInput) {
    throw new Error('Not implemented');
  }

  async getCoachAvailability(_coachId: string) {
    throw new Error('Not implemented');
  }

  async bookPrivateLesson(_userId: string, _input: BookPrivateLessonInput) {
    throw new Error('Not implemented');
  }

  async cancelPrivateLesson(_lessonId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async getUserEnrollments(_userId: string, _query: EnrollmentListQuery) {
    throw new Error('Not implemented');
  }

  async getCoachPrivateLessons(_coachId: string, _query: PrivateLessonListQuery) {
    throw new Error('Not implemented');
  }

  // --- Cross-module service methods ---

  async getGroupClassById(_id: string) {
    throw new Error('Not implemented');
  }

  async getPrivateLessonById(_id: string) {
    throw new Error('Not implemented');
  }

  async getParticipantIds(
    _classId: string,
    _type: 'group-class' | 'private-lesson',
  ): Promise<string[]> {
    throw new Error('Not implemented');
  }
}
