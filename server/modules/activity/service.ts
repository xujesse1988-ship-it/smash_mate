import type {
  CreateActivityInput,
  UpdateActivityInput,
  ActivityListQuery,
  UserActivitiesQuery,
} from './types.js';

export class ActivityService {
  async createActivity(_userId: string, _input: CreateActivityInput) {
    throw new Error('Not implemented');
  }

  async getActivityList(_query: ActivityListQuery) {
    throw new Error('Not implemented');
  }

  async getActivityDetail(_id: string) {
    throw new Error('Not implemented');
  }

  async joinActivity(_activityId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async leaveActivity(_activityId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async updateActivity(_activityId: string, _userId: string, _input: UpdateActivityInput) {
    throw new Error('Not implemented');
  }

  async cancelActivity(_activityId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async getUserActivities(_userId: string, _query: UserActivitiesQuery) {
    throw new Error('Not implemented');
  }

  // --- Cross-module service methods ---

  async getActivityById(_id: string) {
    throw new Error('Not implemented');
  }

  async getParticipantIds(_activityId: string): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async transitionStatuses(): Promise<void> {
    throw new Error('Not implemented');
  }
}
