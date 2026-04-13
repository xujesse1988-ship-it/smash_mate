import {
  resolveUrl,
  handleResponse,
  getAuthHeaders,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoachApplication {
  id: string;
  userId: string;
  certificateUrls: string[];
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitCoachApplicationInput {
  certificateUrls: string[];
  description?: string;
}

// ---------------------------------------------------------------------------
// POST /api/coach-applications
// ---------------------------------------------------------------------------

export async function submitCoachApplication(
  input: SubmitCoachApplicationInput,
): Promise<CoachApplication> {
  const response = await fetch(resolveUrl('/api/coach-applications'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse<CoachApplication>(response);
}

// ---------------------------------------------------------------------------
// GET /api/coach-applications/me
// ---------------------------------------------------------------------------

export async function getMyApplicationStatus(): Promise<CoachApplication | null> {
  const response = await fetch(resolveUrl('/api/coach-applications/me'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<CoachApplication | null>(response);
}
