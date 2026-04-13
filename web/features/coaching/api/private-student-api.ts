import {
  resolveUrl,
  handleResponse,
  getAuthHeaders,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrivateStudentListItem {
  id: string;
  studentId: string;
  nickname: string;
  avatarUrl: string | null;
  isActive: boolean;
  lessonCount: number;
  joinedAt: string;
}

export interface PrivateStudentDetail {
  id: string;
  coachId: string;
  studentId: string;
  nickname: string;
  avatarUrl: string | null;
  isActive: boolean;
  lessonCount: number;
  joinedAt: string;
}

export interface PrivateLessonVenue {
  id: string;
  name: string;
  address: string;
}

export interface PrivateLessonListItem {
  id: string;
  venue: PrivateLessonVenue | null;
  startTime: string;
  endTime: string;
  trainingContent: string | null;
  status: string;
  createdAt: string;
}

export interface PrivateLessonDetail {
  id: string;
  privateStudentId: string;
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

export interface StudentNote {
  id: string;
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// GET /api/private-students
// ---------------------------------------------------------------------------

export async function getPrivateStudents(): Promise<{
  items: PrivateStudentListItem[];
}> {
  const response = await fetch(resolveUrl('/api/private-students'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/private-students/:id
// ---------------------------------------------------------------------------

export async function getPrivateStudentDetail(
  id: string,
): Promise<PrivateStudentDetail> {
  const response = await fetch(resolveUrl(`/api/private-students/${id}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<PrivateStudentDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-students
// ---------------------------------------------------------------------------

export async function addPrivateStudent(studentId: string): Promise<{
  id: string;
  coachId: string;
  studentId: string;
  nickname: string;
  avatarUrl: string | null;
  isActive: boolean;
  joinedAt: string;
}> {
  const response = await fetch(resolveUrl('/api/private-students'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ studentId }),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// DELETE /api/private-students/:id
// ---------------------------------------------------------------------------

export async function removePrivateStudent(
  id: string,
): Promise<{ id: string; isActive: boolean }> {
  const response = await fetch(resolveUrl(`/api/private-students/${id}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/private-students/:id/lessons
// ---------------------------------------------------------------------------

export async function getPrivateLessons(
  privateStudentId: string,
  params?: { status?: string },
): Promise<{ items: PrivateLessonListItem[] }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);

  const qs = searchParams.toString();
  const url = resolveUrl(
    `/api/private-students/${privateStudentId}/lessons${qs ? `?${qs}` : ''}`,
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/private-students/:id/lessons/:lessonId
// ---------------------------------------------------------------------------

export async function getPrivateLessonDetail(
  privateStudentId: string,
  lessonId: string,
): Promise<PrivateLessonDetail> {
  const response = await fetch(
    resolveUrl(
      `/api/private-students/${privateStudentId}/lessons/${lessonId}`,
    ),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse<PrivateLessonDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-students/:id/lessons
// ---------------------------------------------------------------------------

export async function createPrivateLesson(
  privateStudentId: string,
  input: {
    startTime: string;
    endTime: string;
    venueId: string;
    trainingContent?: string;
  },
): Promise<PrivateLessonDetail> {
  const response = await fetch(
    resolveUrl(`/api/private-students/${privateStudentId}/lessons`),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    },
  );

  return handleResponse<PrivateLessonDetail>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/private-students/:id/lessons/:lessonId
// ---------------------------------------------------------------------------

export async function updatePrivateLesson(
  privateStudentId: string,
  lessonId: string,
  input: {
    startTime?: string;
    endTime?: string;
    venueId?: string;
  },
): Promise<PrivateLessonDetail> {
  const response = await fetch(
    resolveUrl(
      `/api/private-students/${privateStudentId}/lessons/${lessonId}`,
    ),
    {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    },
  );

  return handleResponse<PrivateLessonDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-students/:id/lessons/:lessonId/cancel
// ---------------------------------------------------------------------------

export async function cancelPrivateLessonV2(
  privateStudentId: string,
  lessonId: string,
): Promise<{ id: string; status: string }> {
  const response = await fetch(
    resolveUrl(
      `/api/private-students/${privateStudentId}/lessons/${lessonId}/cancel`,
    ),
    {
      method: 'POST',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// PUT /api/private-students/:id/lessons/:lessonId/training-content
// ---------------------------------------------------------------------------

export async function updatePrivateLessonTrainingContent(
  privateStudentId: string,
  lessonId: string,
  content: string,
): Promise<{ id: string; trainingContent: string; updatedAt: string }> {
  const response = await fetch(
    resolveUrl(
      `/api/private-students/${privateStudentId}/lessons/${lessonId}/training-content`,
    ),
    {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ trainingContent: content }),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-students/:id/lessons/:lessonId/notes
// ---------------------------------------------------------------------------

export async function addPrivateLessonNote(
  privateStudentId: string,
  lessonId: string,
  content: string,
): Promise<LessonNote> {
  const response = await fetch(
    resolveUrl(
      `/api/private-students/${privateStudentId}/lessons/${lessonId}/notes`,
    ),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    },
  );

  return handleResponse<LessonNote>(response);
}

// ---------------------------------------------------------------------------
// GET /api/private-students/:id/lessons/:lessonId/notes
// ---------------------------------------------------------------------------

export async function getPrivateLessonNotes(
  privateStudentId: string,
  lessonId: string,
): Promise<{ items: LessonNote[] }> {
  const response = await fetch(
    resolveUrl(
      `/api/private-students/${privateStudentId}/lessons/${lessonId}/notes`,
    ),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/private-students/:id/notes
// ---------------------------------------------------------------------------

export async function addPrivateStudentNote(
  privateStudentId: string,
  content: string,
): Promise<StudentNote> {
  const response = await fetch(
    resolveUrl(`/api/private-students/${privateStudentId}/notes`),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    },
  );

  return handleResponse<StudentNote>(response);
}

// ---------------------------------------------------------------------------
// GET /api/private-students/:id/notes
// ---------------------------------------------------------------------------

export async function getPrivateStudentNotes(
  privateStudentId: string,
): Promise<{ items: StudentNote[] }> {
  const response = await fetch(
    resolveUrl(`/api/private-students/${privateStudentId}/notes`),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// PUT /api/private-students/:id/tags
// ---------------------------------------------------------------------------

export async function setPrivateStudentTags(
  privateStudentId: string,
  tags: string[],
): Promise<{ tags: string[] }> {
  const response = await fetch(
    resolveUrl(`/api/private-students/${privateStudentId}/tags`),
    {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tags }),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/private-students/:id/tags
// ---------------------------------------------------------------------------

export async function getPrivateStudentTags(
  privateStudentId: string,
): Promise<{ tags: string[] }> {
  const response = await fetch(
    resolveUrl(`/api/private-students/${privateStudentId}/tags`),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}
