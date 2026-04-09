import {
  resolveUrl,
  handleResponse,
  getAuthHeaders,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoachSpecialty = 'singles' | 'doubles' | 'footwork' | 'fitness' | 'tactics';

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
// POST /api/upload/avatar
// ---------------------------------------------------------------------------

export async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', file);

  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // NOTE: Do NOT set Content-Type — browser will set it with the correct boundary

  const response = await fetch(resolveUrl('/api/upload/avatar'), {
    method: 'POST',
    headers,
    body: formData,
  });

  const result = await handleResponse<{ avatarUrl: string }>(response);
  return result.avatarUrl;
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

// ---------------------------------------------------------------------------
// GET /api/coaches/:id (教练资料，profile feature 封装)
// ---------------------------------------------------------------------------

export interface CoachProfileForEdit {
  bio: string | null;
  specialties: CoachSpecialty[];
}

export async function getCoachProfile(
  coachId: string,
): Promise<CoachProfileForEdit> {
  const response = await fetch(resolveUrl(`/api/coaches/${coachId}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await handleResponse<{
    userId: string;
    bio: string | null;
    specialties: CoachSpecialty[];
  }>(response);

  return { bio: data.bio, specialties: data.specialties };
}

// ---------------------------------------------------------------------------
// PUT /api/coaches/me (教练资料更新，profile feature 封装)
// ---------------------------------------------------------------------------

export async function updateCoachProfile(data: {
  bio?: string;
  specialties?: CoachSpecialty[];
}): Promise<{
  userId: string;
  bio: string;
  specialties: CoachSpecialty[];
  updatedAt: string;
}> {
  const response = await fetch(resolveUrl('/api/coaches/me'), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}
