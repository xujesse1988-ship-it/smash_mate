import type { CreateReviewInput, ReviewListQuery, CoachRating } from './types.js';

export class ReviewService {
  async createReview(_userId: string, _input: CreateReviewInput) {
    throw new Error('Not implemented');
  }

  async getCoachReviews(_coachId: string, _query: ReviewListQuery) {
    throw new Error('Not implemented');
  }

  async getCoachRating(_coachId: string): Promise<CoachRating> {
    throw new Error('Not implemented');
  }

  async getCoachesRatings(_coachIds: string[]): Promise<CoachRating[]> {
    throw new Error('Not implemented');
  }

  // --- Cross-module service methods ---

  async getCoachAverageRating(_coachId: string): Promise<CoachRating> {
    throw new Error('Not implemented');
  }
}
