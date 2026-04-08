import {
  resolveUrl,
  handleResponse,
  getAuthHeaders,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoachRating {
  coachId: string;
  averageRating: number | null;
  totalCount: number;
}

export interface CoachRatingsResult {
  ratings: CoachRating[];
}

export interface ReviewItem {
  id: string;
  reviewer: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  courseType: string;
  courseId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// GET /api/coaches/:id/reviews
// ---------------------------------------------------------------------------

export async function getCoachReviews(
  coachId: string,
  params: { page?: number; pageSize?: number },
): Promise<PaginatedResult<ReviewItem>> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined)
    searchParams.set('pageSize', String(params.pageSize));

  const qs = searchParams.toString();
  const url = resolveUrl(
    `/api/coaches/${coachId}/reviews${qs ? `?${qs}` : ''}`,
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<PaginatedResult<ReviewItem>>(response);
}

// ---------------------------------------------------------------------------
// GET /api/coaches/:id/rating
// ---------------------------------------------------------------------------

export async function getCoachRating(coachId: string): Promise<CoachRating> {
  const response = await fetch(resolveUrl(`/api/coaches/${coachId}/rating`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<CoachRating>(response);
}

// ---------------------------------------------------------------------------
// POST /api/coaches/ratings
// ---------------------------------------------------------------------------

export async function getCoachesRatings(
  coachIds: string[],
): Promise<CoachRatingsResult> {
  const response = await fetch(resolveUrl('/api/coaches/ratings'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ coachIds }),
  });

  return handleResponse<CoachRatingsResult>(response);
}

// ---------------------------------------------------------------------------
// POST /api/reviews
// ---------------------------------------------------------------------------

export async function createReview(data: {
  coachId: string;
  courseType: string;
  courseId: string;
  rating: number;
  comment?: string;
}): Promise<{
  id: string;
  reviewerId: string;
  coachId: string;
  courseType: string;
  courseId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}> {
  const body: Record<string, unknown> = {
    coachId: data.coachId,
    courseType: data.courseType,
    courseId: data.courseId,
    rating: data.rating,
  };
  if (data.comment !== undefined) {
    body.comment = data.comment;
  }

  const response = await fetch(resolveUrl('/api/reviews'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  return handleResponse(response);
}
