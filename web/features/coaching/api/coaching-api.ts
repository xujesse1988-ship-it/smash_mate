import { resolveUrl, handleResponse, getAuthHeaders } from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoachListItem {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  specialties: string[];
  studentCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SlotVenue {
  id: string;
  name: string;
  address: string;
}

export interface CoachProfileGroupClass {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  venue: SlotVenue | null;
  maxParticipants: number;
  currentParticipants: number;
  feeDescription: string | null;
  status: string;
}

export interface CoachProfileSlot {
  id: string;
  startTime: string;
  endTime: string;
  venues: SlotVenue[];
  feeDescription: string | null;
  isBooked: boolean;
}

export interface CoachProfile {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  specialties: string[];
  studentCount: number;
  groupClasses: CoachProfileGroupClass[];
  privateLessonSlots: CoachProfileSlot[];
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface GroupClassEnrollment {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  enrolledAt: string;
}

export interface GroupClassDetail {
  id: string;
  coachId: string;
  coach: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  title: string;
  venue: Venue | null;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  feeDescription: string | null;
  status: string;
  enrollments: GroupClassEnrollment[];
  createdAt: string;
}

export interface EnrollResult {
  groupClassId: string;
  userId: string;
  currentParticipants: number;
  status: string;
  enrolledAt: string;
}

export interface CancelEnrollResult {
  groupClassId: string;
  userId: string;
  currentParticipants: number;
  status: string;
}

export interface AvailabilitySlot {
  id: string;
  startTime: string;
  endTime: string;
  venues: SlotVenue[];
  feeDescription: string | null;
  isBooked: boolean;
}

export interface AvailabilityResult {
  slots: AvailabilitySlot[];
}

export interface PrivateLessonBookResult {
  id: string;
  slotId: string;
  coachId: string;
  studentId: string;
  venue: SlotVenue | null;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
}

export interface CoachPrivateLesson {
  id: string;
  slot: {
    startTime: string;
    endTime: string;
  };
  venue: SlotVenue | null;
  student: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
  status: string;
  createdAt: string;
}

export interface EnrollmentGroupClass {
  id: string;
  title: string;
  coachId: string;
  coachNickname: string;
  venue: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
  status: string;
  enrolledAt: string;
}

export interface EnrollmentPrivateLesson {
  id: string;
  coachId: string;
  coachNickname: string;
  venue: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
}

export interface EnrollmentClassLesson {
  id: string;
  studentClassId: string;
  studentClassName: string;
  coachId: string;
  coachNickname: string;
  venue: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
}

export interface EnrollmentItem {
  type: 'group-class' | 'private-lesson' | 'class-lesson';
  groupClass: EnrollmentGroupClass | null;
  privateLesson: EnrollmentPrivateLesson | null;
  classLesson: EnrollmentClassLesson | null;
}

// ---------------------------------------------------------------------------
// GET /api/coaches
// ---------------------------------------------------------------------------

export async function getCoaches(params: {
  page?: number;
  pageSize?: number;
  specialty?: string;
}): Promise<PaginatedResult<CoachListItem>> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  if (params.specialty !== undefined) searchParams.set('specialty', params.specialty);

  const qs = searchParams.toString();
  const url = resolveUrl(`/api/coaches${qs ? `?${qs}` : ''}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<PaginatedResult<CoachListItem>>(response);
}

// ---------------------------------------------------------------------------
// GET /api/coaches/:id
// ---------------------------------------------------------------------------

export async function getCoachProfile(id: string): Promise<CoachProfile> {
  const response = await fetch(resolveUrl(`/api/coaches/${id}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<CoachProfile>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/coaches/me
// ---------------------------------------------------------------------------

export async function updateCoachProfile(data: {
  bio?: string;
  specialties?: string[];
}): Promise<{ userId: string; bio: string; specialties: string[]; updatedAt: string }> {
  const response = await fetch(resolveUrl('/api/coaches/me'), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/group-classes
// ---------------------------------------------------------------------------

export async function createGroupClass(data: {
  venueId: string;
  title: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  feeDescription?: string;
}): Promise<{
  id: string;
  coachId: string;
  title: string;
  venue: Venue;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  feeDescription: string | null;
  status: string;
  createdAt: string;
}> {
  const response = await fetch(resolveUrl('/api/group-classes'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/group-classes/:id
// ---------------------------------------------------------------------------

export async function getGroupClassDetail(id: string): Promise<GroupClassDetail> {
  const response = await fetch(resolveUrl(`/api/group-classes/${id}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<GroupClassDetail>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/group-classes/:id
// ---------------------------------------------------------------------------

export async function updateGroupClass(
  id: string,
  data: {
    title?: string;
    venueId?: string;
    startTime?: string;
    endTime?: string;
    maxParticipants?: number;
    feeDescription?: string;
  },
): Promise<{
  id: string;
  coachId: string;
  title: string;
  venue: Venue;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  feeDescription: string | null;
  status: string;
  createdAt: string;
}> {
  const response = await fetch(resolveUrl(`/api/group-classes/${id}`), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/group-classes/:id/cancel
// ---------------------------------------------------------------------------

export async function cancelGroupClass(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(resolveUrl(`/api/group-classes/${id}/cancel`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/group-classes/:id/enroll
// ---------------------------------------------------------------------------

export async function enrollGroupClass(id: string): Promise<EnrollResult> {
  const response = await fetch(resolveUrl(`/api/group-classes/${id}/enroll`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  return handleResponse<EnrollResult>(response);
}

// ---------------------------------------------------------------------------
// POST /api/group-classes/:id/cancel-enrollment
// ---------------------------------------------------------------------------

export async function cancelEnrollment(id: string): Promise<CancelEnrollResult> {
  const response = await fetch(resolveUrl(`/api/group-classes/${id}/cancel-enrollment`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  return handleResponse<CancelEnrollResult>(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-lessons/availability
// ---------------------------------------------------------------------------

export async function setAvailability(data: {
  slots: Array<{
    startTime: string;
    endTime: string;
    venueIds?: string[];
    feeDescription?: string;
  }>;
}): Promise<{
  slots: Array<{
    id: string;
    coachId: string;
    startTime: string;
    endTime: string;
    venueIds: string[];
    feeDescription: string | null;
    isBooked: boolean;
    createdAt: string;
  }>;
}> {
  const response = await fetch(resolveUrl('/api/private-lessons/availability'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/coaches/:id/availability
// ---------------------------------------------------------------------------

export async function getCoachAvailability(
  coachId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<AvailabilityResult> {
  const searchParams = new URLSearchParams();

  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const qs = searchParams.toString();
  const url = resolveUrl(`/api/coaches/${coachId}/availability${qs ? `?${qs}` : ''}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<AvailabilityResult>(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-lessons/book
// ---------------------------------------------------------------------------

export async function bookPrivateLesson(data: {
  slotId: string;
  venueId?: string;
}): Promise<PrivateLessonBookResult> {
  const body: Record<string, string> = { slotId: data.slotId };
  if (data.venueId !== undefined) {
    body.venueId = data.venueId;
  }

  const response = await fetch(resolveUrl('/api/private-lessons/book'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  return handleResponse<PrivateLessonBookResult>(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-lessons/:id/cancel
// ---------------------------------------------------------------------------

export async function cancelPrivateLesson(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(resolveUrl(`/api/private-lessons/${id}/cancel`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/users/:id/enrollments
// ---------------------------------------------------------------------------

export async function getUserEnrollments(
  userId: string,
  params: { page?: number; pageSize?: number; type?: string; status?: string },
): Promise<PaginatedResult<EnrollmentItem>> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  if (params.type !== undefined) searchParams.set('type', params.type);
  if (params.status !== undefined) searchParams.set('status', params.status);

  const qs = searchParams.toString();
  const url = resolveUrl(`/api/users/${userId}/enrollments${qs ? `?${qs}` : ''}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<PaginatedResult<EnrollmentItem>>(response);
}

// ---------------------------------------------------------------------------
// GET /api/coaches/:id/private-lessons
// ---------------------------------------------------------------------------

export async function getCoachPrivateLessons(
  coachId: string,
  params: { page?: number; pageSize?: number; status?: string },
): Promise<PaginatedResult<CoachPrivateLesson>> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  if (params.status !== undefined) searchParams.set('status', params.status);

  const qs = searchParams.toString();
  const url = resolveUrl(`/api/coaches/${coachId}/private-lessons${qs ? `?${qs}` : ''}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<PaginatedResult<CoachPrivateLesson>>(response);
}
