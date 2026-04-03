export async function getCoachReviews(
  _coachId: string,
  _params: { page?: number; pageSize?: number },
) {
  throw new Error('Not implemented');
}

export async function getCoachRating(_coachId: string) {
  throw new Error('Not implemented');
}

export async function getCoachesRatings(_coachIds: string[]) {
  throw new Error('Not implemented');
}

export async function createReview(_data: {
  coachId: string;
  courseType: string;
  courseId: string;
  rating: number;
  comment?: string;
}) {
  throw new Error('Not implemented');
}
