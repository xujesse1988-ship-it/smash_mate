import {
  resolveUrl,
  handleResponse,
  getAuthHeaders,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentClassListItem {
  id: string;
  coachId: string;
  name: string;
  memberCount: number;
  lessonCount: number;
  createdAt: string;
}

export interface StudentClassMember {
  studentId: string;
  nickname: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface StudentClassDetail {
  id: string;
  coachId: string;
  name: string;
  memberCount: number;
  lessonCount: number;
  members: StudentClassMember[];
  createdAt: string;
}

export interface ClassLessonVenue {
  id: string;
  name: string;
  address: string;
}

export interface ClassLessonListItem {
  id: string;
  venue: ClassLessonVenue | null;
  startTime: string;
  endTime: string;
  trainingContent: string | null;
  status: string;
  createdAt: string;
}

export interface ClassLessonDetail {
  id: string;
  studentClassId: string;
  coachId: string;
  venue: ClassLessonVenue | null;
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

export interface UserSearchResult {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  phoneLast4: string;
}

// ---------------------------------------------------------------------------
// GET /api/student-classes
// ---------------------------------------------------------------------------

export async function getStudentClasses(): Promise<{
  items: StudentClassListItem[];
}> {
  const response = await fetch(resolveUrl('/api/student-classes'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/student-classes/:id
// ---------------------------------------------------------------------------

export async function getStudentClassDetail(
  classId: string,
): Promise<StudentClassDetail> {
  const response = await fetch(resolveUrl(`/api/student-classes/${classId}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<StudentClassDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/student-classes
// ---------------------------------------------------------------------------

export async function createStudentClass(input: {
  name: string;
}): Promise<StudentClassListItem> {
  const response = await fetch(resolveUrl('/api/student-classes'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse<StudentClassListItem>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/student-classes/:id
// ---------------------------------------------------------------------------

export async function updateStudentClass(
  classId: string,
  input: { name: string },
): Promise<{ id: string; coachId: string; name: string; updatedAt: string }> {
  const response = await fetch(resolveUrl(`/api/student-classes/${classId}`), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// DELETE /api/student-classes/:id
// ---------------------------------------------------------------------------

export async function deleteStudentClass(
  classId: string,
): Promise<{ success: boolean }> {
  const response = await fetch(resolveUrl(`/api/student-classes/${classId}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/student-classes/:id/members
// ---------------------------------------------------------------------------

export async function addStudentToClass(
  classId: string,
  studentId: string,
): Promise<{
  studentClassId: string;
  studentId: string;
  nickname: string;
  joinedAt: string;
}> {
  const response = await fetch(
    resolveUrl(`/api/student-classes/${classId}/members`),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ studentId }),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// DELETE /api/student-classes/:id/members/:studentId
// ---------------------------------------------------------------------------

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
): Promise<{ success: boolean }> {
  const response = await fetch(
    resolveUrl(`/api/student-classes/${classId}/members/${studentId}`),
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/users/search?q=xxx
// ---------------------------------------------------------------------------

export async function searchUsers(
  query: string,
): Promise<{ items: UserSearchResult[] }> {
  const url = resolveUrl(
    `/api/users/search?q=${encodeURIComponent(query)}`,
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/student-classes/:id/lessons
// ---------------------------------------------------------------------------

export async function getClassLessons(
  classId: string,
  params?: { status?: string },
): Promise<{ items: ClassLessonListItem[] }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);

  const qs = searchParams.toString();
  const url = resolveUrl(
    `/api/student-classes/${classId}/lessons${qs ? `?${qs}` : ''}`,
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/student-classes/:id/lessons/:lessonId
// ---------------------------------------------------------------------------

export async function getClassLessonDetail(
  classId: string,
  lessonId: string,
): Promise<ClassLessonDetail> {
  const response = await fetch(
    resolveUrl(`/api/student-classes/${classId}/lessons/${lessonId}`),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse<ClassLessonDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/student-classes/:id/lessons
// ---------------------------------------------------------------------------

export async function createClassLesson(
  classId: string,
  input: {
    startTime: string;
    endTime: string;
    venueId: string;
    trainingContent?: string;
  },
): Promise<ClassLessonDetail> {
  const response = await fetch(
    resolveUrl(`/api/student-classes/${classId}/lessons`),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    },
  );

  return handleResponse<ClassLessonDetail>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/student-classes/:id/lessons/:lessonId
// ---------------------------------------------------------------------------

export async function updateClassLesson(
  classId: string,
  lessonId: string,
  input: {
    startTime?: string;
    endTime?: string;
    venueId?: string;
  },
): Promise<ClassLessonDetail> {
  const response = await fetch(
    resolveUrl(`/api/student-classes/${classId}/lessons/${lessonId}`),
    {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    },
  );

  return handleResponse<ClassLessonDetail>(response);
}

// ---------------------------------------------------------------------------
// POST /api/student-classes/:id/lessons/:lessonId/cancel
// ---------------------------------------------------------------------------

export async function cancelClassLesson(
  classId: string,
  lessonId: string,
): Promise<{ id: string; status: string }> {
  const response = await fetch(
    resolveUrl(`/api/student-classes/${classId}/lessons/${lessonId}/cancel`),
    {
      method: 'POST',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// PUT /api/student-classes/:id/lessons/:lessonId/training-content
// ---------------------------------------------------------------------------

export async function updateTrainingContent(
  classId: string,
  lessonId: string,
  content: string,
): Promise<{ id: string; trainingContent: string; updatedAt: string }> {
  const response = await fetch(
    resolveUrl(
      `/api/student-classes/${classId}/lessons/${lessonId}/training-content`,
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
// POST /api/student-classes/:id/lessons/:lessonId/notes
// ---------------------------------------------------------------------------

export async function addLessonNote(
  classId: string,
  lessonId: string,
  content: string,
): Promise<{
  id: string;
  classLessonId: string;
  coachId: string;
  content: string;
  createdAt: string;
}> {
  const response = await fetch(
    resolveUrl(`/api/student-classes/${classId}/lessons/${lessonId}/notes`),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/student-classes/:id/lessons/:lessonId/notes
// ---------------------------------------------------------------------------

export async function getLessonNotes(
  classId: string,
  lessonId: string,
): Promise<{ items: LessonNote[] }> {
  const response = await fetch(
    resolveUrl(`/api/student-classes/${classId}/lessons/${lessonId}/notes`),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// POST /api/student-classes/:id/members/:studentId/notes
// ---------------------------------------------------------------------------

export async function addStudentNote(
  classId: string,
  studentId: string,
  content: string,
): Promise<{
  id: string;
  coachId: string;
  studentId: string;
  studentClassId: string;
  content: string;
  createdAt: string;
}> {
  const response = await fetch(
    resolveUrl(
      `/api/student-classes/${classId}/members/${studentId}/notes`,
    ),
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/student-classes/:id/members/:studentId/notes
// ---------------------------------------------------------------------------

export async function getStudentNotes(
  classId: string,
  studentId: string,
): Promise<{ items: StudentNote[] }> {
  const response = await fetch(
    resolveUrl(
      `/api/student-classes/${classId}/members/${studentId}/notes`,
    ),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// PUT /api/student-classes/:id/members/:studentId/tags
// ---------------------------------------------------------------------------

export async function setStudentTags(
  classId: string,
  studentId: string,
  tags: string[],
): Promise<{ tags: string[] }> {
  const response = await fetch(
    resolveUrl(
      `/api/student-classes/${classId}/members/${studentId}/tags`,
    ),
    {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tags }),
    },
  );

  return handleResponse(response);
}

// ---------------------------------------------------------------------------
// GET /api/student-classes/:id/members/:studentId/tags
// ---------------------------------------------------------------------------

export async function getStudentTags(
  classId: string,
  studentId: string,
): Promise<{ tags: string[] }> {
  const response = await fetch(
    resolveUrl(
      `/api/student-classes/${classId}/members/${studentId}/tags`,
    ),
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  );

  return handleResponse(response);
}
