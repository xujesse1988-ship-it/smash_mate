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

export interface UserPublicInfo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
  createdAt: string;
}

export interface MatchStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

// ---------------------------------------------------------------------------
// GET /api/users/me
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await fetch(resolveUrl('/api/users/me'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<CurrentUser>(response);
}

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------

export async function getUserPublicInfo(id: string): Promise<UserPublicInfo> {
  const response = await fetch(resolveUrl(`/api/users/${id}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<UserPublicInfo>(response);
}

// ---------------------------------------------------------------------------
// GET /api/users/:id/match-stats
// ---------------------------------------------------------------------------

export async function getMatchStats(userId: string): Promise<MatchStats> {
  const response = await fetch(resolveUrl(`/api/users/${userId}/match-stats`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<MatchStats>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/users/me
// ---------------------------------------------------------------------------

export async function updateProfile(data: {
  nickname?: string;
  avatarUrl?: string;
  bio?: string;
}): Promise<CurrentUser> {
  const response = await fetch(resolveUrl('/api/users/me'), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<CurrentUser>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/users/me/coach-role
// ---------------------------------------------------------------------------

export async function enableCoachRole(): Promise<CurrentUser> {
  const response = await fetch(resolveUrl('/api/users/me/coach-role'), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ isCoach: true }),
  });

  return handleResponse<CurrentUser>(response);
}
