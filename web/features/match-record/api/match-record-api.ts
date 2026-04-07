// TODO: resolveUrl, handleResponse, getAuthHeaders 与其他 api 文件重复，
// 待统一迁移到共享 API Client（shared/api/client.ts）
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

export interface MatchRecordPlayer {
  userId?: string;
  guestId?: string;
  nickname: string;
  avatarUrl?: string | null;
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

export interface PaginatedMatchRecords {
  items: MatchRecord[];
}

// ---------------------------------------------------------------------------
// POST /api/match-records
// ---------------------------------------------------------------------------

export async function createMatchRecord(data: {
  sourceType: string;
  sourceId: string;
  matchType: string;
  players: Array<{
    side: string;
    userId?: string;
    guestName?: string;
  }>;
  games: Array<{
    gameNumber: number;
    scoreA: number;
    scoreB: number;
  }>;
}): Promise<MatchRecord> {
  const response = await fetch(resolveUrl('/api/match-records'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<MatchRecord>(response);
}

// ---------------------------------------------------------------------------
// DELETE /api/match-records/:id
// ---------------------------------------------------------------------------

export async function deleteMatchRecord(id: string): Promise<void> {
  const response = await fetch(resolveUrl(`/api/match-records/${id}`), {
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
// GET /api/{source-type-pluralized}/:id/match-records
// ---------------------------------------------------------------------------

const SOURCE_TYPE_PATH_MAP: Record<string, string> = {
  'group-class': 'group-classes',
  'private-lesson': 'private-lessons',
  activity: 'activities',
};

export async function getSourceMatchRecords(
  sourceType: string,
  sourceId: string,
  _params: { page?: number; pageSize?: number },
): Promise<PaginatedMatchRecords> {
  const pathSegment = SOURCE_TYPE_PATH_MAP[sourceType] || sourceType;
  const url = resolveUrl(`/api/${pathSegment}/${sourceId}/match-records`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<PaginatedMatchRecords>(response);
}

// ---------------------------------------------------------------------------
// GET /api/users/:id/match-records
// ---------------------------------------------------------------------------

export async function getUserMatchRecords(
  userId: string,
  params: { page?: number; pageSize?: number },
): Promise<{ items: MatchRecord[]; total: number; page: number; pageSize: number }> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined)
    searchParams.set('pageSize', String(params.pageSize));

  const qs = searchParams.toString();
  const url = resolveUrl(
    `/api/users/${userId}/match-records${qs ? `?${qs}` : ''}`,
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/users/:id/match-stats
// ---------------------------------------------------------------------------

export async function getUserMatchStats(userId: string) {
  const response = await fetch(
    resolveUrl(`/api/users/${userId}/match-stats`),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}
