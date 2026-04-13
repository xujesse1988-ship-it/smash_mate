import {
  resolveUrl,
  getAdminAuthHeaders,
  handleResponse,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoachApplicationListItem {
  id: string;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  certificateUrls: string[];
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface CoachApplicationDetail {
  id: string;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string;
  certificateUrls: string[];
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoachApplicationReviewResult {
  id: string;
  userId: string;
  certificateUrls: string[];
  description: string | null;
  status: 'approved' | 'rejected';
  rejectReason: string | null;
  reviewedBy: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// GET /api/admin/coach-applications
// ---------------------------------------------------------------------------

export async function getApplicationList(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<CoachApplicationListItem>> {
  const searchParams = new URLSearchParams();
  if (params.status !== undefined) {
    searchParams.set('status', params.status);
  }
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }

  const queryString = searchParams.toString();
  const url = resolveUrl(
    `/api/admin/coach-applications${queryString ? `?${queryString}` : ''}`,
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });

  return handleResponse<PaginatedResponse<CoachApplicationListItem>>(response);
}

// ---------------------------------------------------------------------------
// GET /api/admin/coach-applications/:id
// ---------------------------------------------------------------------------

export async function getApplicationDetail(
  id: string,
): Promise<CoachApplicationDetail> {
  const response = await fetch(
    resolveUrl(`/api/admin/coach-applications/${id}`),
    {
      method: 'GET',
      headers: getAdminAuthHeaders(),
    },
  );

  return handleResponse<CoachApplicationDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/admin/coach-applications/:id/review
// ---------------------------------------------------------------------------

export async function reviewApplication(
  id: string,
  input: { status: 'approved' | 'rejected'; rejectReason?: string },
): Promise<CoachApplicationReviewResult> {
  const response = await fetch(
    resolveUrl(`/api/admin/coach-applications/${id}/review`),
    {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify(input),
    },
  );

  return handleResponse<CoachApplicationReviewResult>(response);
}
