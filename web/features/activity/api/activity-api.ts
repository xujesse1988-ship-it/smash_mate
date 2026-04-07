interface ApiError {
  code: string;
  message: string;
}

function resolveUrl(path: string): string {
  if (typeof globalThis.location !== 'undefined') {
    return path;
  }
  return `http://localhost${path}`;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    const error = body.error as ApiError;
    const err = new Error(error.message) as Error & { code: string };
    err.code = error.code;
    throw err;
  }

  return body.data as T;
}

function getAuthHeaders(): Record<string, string> {
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface ActivityListItem {
  id: string;
  creatorId: string;
  venue: Venue | null;
  title: string | null;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  distance?: number;
  createdAt: string;
}

export interface Participant {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface ActivityDetail {
  id: string;
  creatorId: string;
  creator: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  venue: Venue | null;
  title: string | null;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  participants: Participant[];
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JoinResult {
  activityId: string;
  userId: string;
  currentParticipants: number;
  status: string;
  joinedAt: string;
}

export interface LeaveResult {
  activityId: string;
  userId: string;
  currentParticipants: number;
  status: string;
}

export interface CancelResult {
  id: string;
  status: string;
}

// ---------------------------------------------------------------------------
// GET /api/activities
// ---------------------------------------------------------------------------

export async function getActivities(params: {
  page?: number;
  pageSize?: number;
  dateFilter?: string;
  dateStart?: string;
  dateEnd?: string;
  maxDistance?: number;
  latitude?: number;
  longitude?: number;
  hasSlot?: boolean;
  sortBy?: string;
}): Promise<PaginatedResult<ActivityListItem>> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined)
    searchParams.set('pageSize', String(params.pageSize));
  if (params.dateFilter !== undefined)
    searchParams.set('dateFilter', params.dateFilter);
  if (params.dateStart !== undefined)
    searchParams.set('dateStart', params.dateStart);
  if (params.dateEnd !== undefined) searchParams.set('dateEnd', params.dateEnd);
  if (params.maxDistance !== undefined)
    searchParams.set('maxDistance', String(params.maxDistance));
  if (params.latitude !== undefined)
    searchParams.set('latitude', String(params.latitude));
  if (params.longitude !== undefined)
    searchParams.set('longitude', String(params.longitude));
  if (params.hasSlot !== undefined)
    searchParams.set('hasSlot', String(params.hasSlot));
  if (params.sortBy !== undefined) searchParams.set('sortBy', params.sortBy);

  const qs = searchParams.toString();
  const url = resolveUrl(`/api/activities${qs ? `?${qs}` : ''}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<PaginatedResult<ActivityListItem>>(response);
}

// ---------------------------------------------------------------------------
// GET /api/activities/:id
// ---------------------------------------------------------------------------

export async function getActivityDetail(id: string): Promise<ActivityDetail> {
  const response = await fetch(resolveUrl(`/api/activities/${id}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<ActivityDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/activities
// ---------------------------------------------------------------------------

export async function createActivity(data: {
  venueId: string;
  title?: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
}): Promise<ActivityDetail> {
  const body: Record<string, unknown> = {
    venueId: data.venueId,
    startTime: data.startTime,
    endTime: data.endTime,
    maxParticipants: data.maxParticipants,
  };
  if (data.title !== undefined) {
    body.title = data.title;
  }

  const response = await fetch(resolveUrl('/api/activities'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  return handleResponse<ActivityDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/activities/:id/join
// ---------------------------------------------------------------------------

export async function joinActivity(id: string): Promise<JoinResult> {
  const response = await fetch(resolveUrl(`/api/activities/${id}/join`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  return handleResponse<JoinResult>(response);
}

// ---------------------------------------------------------------------------
// POST /api/activities/:id/leave
// ---------------------------------------------------------------------------

export async function leaveActivity(id: string): Promise<LeaveResult> {
  const response = await fetch(resolveUrl(`/api/activities/${id}/leave`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  return handleResponse<LeaveResult>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/activities/:id
// ---------------------------------------------------------------------------

export async function updateActivity(
  id: string,
  data: {
    venueId?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    maxParticipants?: number;
  },
): Promise<ActivityListItem> {
  const response = await fetch(resolveUrl(`/api/activities/${id}`), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<ActivityListItem>(response);
}

// ---------------------------------------------------------------------------
// POST /api/activities/:id/cancel
// ---------------------------------------------------------------------------

export async function cancelActivity(id: string): Promise<CancelResult> {
  const response = await fetch(resolveUrl(`/api/activities/${id}/cancel`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  return handleResponse<CancelResult>(response);
}

// ---------------------------------------------------------------------------
// GET /api/activities/:id/match-records
// ---------------------------------------------------------------------------

export interface MatchRecordPlayer {
  userId: string | null;
  nickname: string;
  avatarUrl: string | null;
}

export interface MatchRecord {
  id: string;
  sourceType: string;
  sourceId: string;
  matchType: string;
  recordedBy: string;
  recorder: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  players: {
    sideA: MatchRecordPlayer[];
    sideB: MatchRecordPlayer[];
  };
  games: Array<{
    gameNumber: number;
    scoreA: number;
    scoreB: number;
  }>;
  result: string;
  createdAt: string;
}

export async function getActivityMatchRecords(
  activityId: string,
): Promise<MatchRecord[]> {
  const response = await fetch(
    resolveUrl(`/api/activities/${activityId}/match-records`),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse<MatchRecord[]>(response);
}

// ---------------------------------------------------------------------------
// DELETE /api/match-records/:id
// ---------------------------------------------------------------------------

export async function deleteMatchRecord(recordId: string): Promise<void> {
  const response = await fetch(resolveUrl(`/api/match-records/${recordId}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const body = await response.json();
    const error = body.error as ApiError;
    const err = new Error(error.message) as Error & { code: string };
    err.code = error.code;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET /api/users/:id/activities
// ---------------------------------------------------------------------------

export async function getUserActivities(
  userId: string,
  params: { page?: number; pageSize?: number; role?: string; status?: string },
): Promise<PaginatedResult<ActivityListItem>> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined)
    searchParams.set('pageSize', String(params.pageSize));
  if (params.role !== undefined) searchParams.set('role', params.role);
  if (params.status !== undefined) searchParams.set('status', params.status);

  const qs = searchParams.toString();
  const url = resolveUrl(`/api/users/${userId}/activities${qs ? `?${qs}` : ''}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<PaginatedResult<ActivityListItem>>(response);
}
