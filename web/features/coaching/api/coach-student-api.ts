import {
  resolveUrl,
  handleResponse,
  getAuthHeaders,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoachStudentListItem {
  studentId: string;
  nickname: string;
  avatarUrl: string | null;
  phoneLast4: string | null;
  firstMetAt: string;
  source: string;
  tags: string[];
  studentClasses: { id: string; name: string }[];
}

export interface CoachStudentDetail {
  studentId: string;
  nickname: string;
  avatarUrl: string | null;
  phoneLast4: string | null;
  firstMetAt: string;
  source: string;
  tags: string[];
  studentClasses: { id: string; name: string }[];
}

export interface CoachStudentLesson {
  id: string;
  coachId: string;
  studentId: string | null;
  venue: { id: string; name: string; address: string } | null;
  startTime: string;
  endTime: string;
  trainingContent: string | null;
  feeDescription: string | null;
  source: string | null;
  status: string;
  createdAt: string;
}

export interface StudentSearchResult {
  userId: string;
  nickname: string;
  phoneLast4: string;
}

// ---------------------------------------------------------------------------
// GET /api/coach-students
// ---------------------------------------------------------------------------

export async function getCoachStudents(params?: {
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: CoachStudentListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const searchParams = new URLSearchParams();
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));

  const qs = searchParams.toString();
  const response = await fetch(
    resolveUrl(`/api/coach-students${qs ? `?${qs}` : ''}`),
    { method: 'GET', headers: getAuthHeaders() },
  );
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/coach-students/:studentId
// ---------------------------------------------------------------------------

export async function getCoachStudentDetail(
  studentId: string,
): Promise<CoachStudentDetail> {
  const response = await fetch(
    resolveUrl(`/api/coach-students/${studentId}`),
    { method: 'GET', headers: getAuthHeaders() },
  );
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/coach-students
// ---------------------------------------------------------------------------

export async function addCoachStudent(studentId: string): Promise<{
  id: string;
  coachId: string;
  studentId: string;
  source: string;
  firstMetAt: string;
}> {
  const response = await fetch(resolveUrl('/api/coach-students'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ studentId }),
  });
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/coach-students/search-by-phone
// ---------------------------------------------------------------------------

export async function searchStudentByPhone(
  phone: string,
): Promise<StudentSearchResult> {
  const response = await fetch(
    resolveUrl('/api/coach-students/search-by-phone'),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ phone }),
    },
  );
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// PUT /api/coach-students/:studentId/tags
// ---------------------------------------------------------------------------

export async function setCoachStudentTags(
  studentId: string,
  tags: string[],
): Promise<{ tags: string[] }> {
  const response = await fetch(
    resolveUrl(`/api/coach-students/${studentId}/tags`),
    {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tags }),
    },
  );
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/coach-students/:studentId/lessons
// ---------------------------------------------------------------------------

export async function scheduleLessonForStudent(
  studentId: string,
  input: {
    startTime: string;
    endTime: string;
    venueId?: string;
    feeDescription?: string;
    trainingContent?: string;
  },
): Promise<CoachStudentLesson> {
  const response = await fetch(
    resolveUrl(`/api/coach-students/${studentId}/lessons`),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    },
  );
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/coach-students/:studentId/lessons
// ---------------------------------------------------------------------------

export async function getCoachStudentLessons(
  studentId: string,
  params?: { status?: string; page?: number; pageSize?: number },
): Promise<{
  items: CoachStudentLesson[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));

  const qs = searchParams.toString();
  const response = await fetch(
    resolveUrl(`/api/coach-students/${studentId}/lessons${qs ? `?${qs}` : ''}`),
    { method: 'GET', headers: getAuthHeaders() },
  );
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// Private Lesson types
// ---------------------------------------------------------------------------

export interface PrivateLessonVenue {
  id: string;
  name: string;
  address: string;
}

export interface PrivateLessonDetail {
  id: string;
  coachId: string;
  studentId: string;
  venue: PrivateLessonVenue | null;
  startTime: string;
  endTime: string;
  trainingContent: string | null;
  status: string;
  createdAt: string;
}

export interface LessonNote {
  id: string;
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// GET /api/private-lessons/:id
// ---------------------------------------------------------------------------

export async function getPrivateLessonDetail(
  lessonId: string,
): Promise<PrivateLessonDetail> {
  const response = await fetch(
    resolveUrl(`/api/private-lessons/${lessonId}`),
    { method: 'GET', headers: getAuthHeaders() },
  );
  return handleResponse<PrivateLessonDetail>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/private-lessons/:id/training-content
// ---------------------------------------------------------------------------

export async function updatePrivateLessonTrainingContent(
  lessonId: string,
  content: string,
): Promise<{ id: string; trainingContent: string; updatedAt: string }> {
  const response = await fetch(
    resolveUrl(`/api/private-lessons/${lessonId}/training-content`),
    {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ trainingContent: content }),
    },
  );
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-lessons/:id/cancel
// ---------------------------------------------------------------------------

export async function cancelPrivateLesson(
  lessonId: string,
): Promise<{ id: string; status: string }> {
  const response = await fetch(
    resolveUrl(`/api/private-lessons/${lessonId}/cancel`),
    { method: 'POST', headers: getAuthHeaders() },
  );
  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-lessons/:id/notes
// ---------------------------------------------------------------------------

export async function addPrivateLessonNote(
  lessonId: string,
  content: string,
): Promise<LessonNote> {
  const response = await fetch(
    resolveUrl(`/api/private-lessons/${lessonId}/notes`),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    },
  );
  return handleResponse<LessonNote>(response);
}

// ---------------------------------------------------------------------------
// GET /api/private-lessons/:id/notes
// ---------------------------------------------------------------------------

export async function getPrivateLessonNotes(
  lessonId: string,
): Promise<{ items: LessonNote[] }> {
  const response = await fetch(
    resolveUrl(`/api/private-lessons/${lessonId}/notes`),
    { method: 'GET', headers: getAuthHeaders() },
  );
  return handleResponse(response);
}
