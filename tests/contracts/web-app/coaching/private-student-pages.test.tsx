/**
 * 契约测试: web-app/coaching — 固定私教学员（GC）API 调用层 + 页面渲染
 *
 * 覆盖接口:
 *   - GET    /api/private-students                             (私教学员列表)
 *   - GET    /api/private-students/:id                         (私教学员详情)
 *   - POST   /api/private-students                             (添加私教学员)
 *   - DELETE /api/private-students/:id                         (移除私教学员)
 *   - GET    /api/private-students/:id/lessons                 (私教课程列表)
 *   - GET    /api/private-students/:id/lessons/:lessonId       (私教课程详情)
 *   - POST   /api/private-students/:id/lessons                 (创建私教课程)
 *   - PUT    /api/private-students/:id/lessons/:lessonId       (编辑私教课程)
 *   - POST   /api/private-students/:id/lessons/:lessonId/cancel (取消私教课程)
 *   - PUT    /api/private-students/:id/lessons/:lessonId/training-content (更新训练内容)
 *   - POST   /api/private-students/:id/lessons/:lessonId/notes (添加课程笔记)
 *   - GET    /api/private-students/:id/lessons/:lessonId/notes (课程笔记列表)
 *   - POST   /api/private-students/:id/notes                  (添加学员笔记)
 *   - GET    /api/private-students/:id/notes                  (学员笔记列表)
 *   - PUT    /api/private-students/:id/tags                   (设置学员标签)
 *   - GET    /api/private-students/:id/tags                   (获取学员标签)
 *
 * 覆盖页面:
 *   - PrivateStudentListPage (/my-private-students)
 *   - PrivateStudentDetailPage (/my-private-students/:id)
 *   - PrivateLessonDetailPage (/my-private-students/:id/lessons/:lessonId)
 *
 * 来源文档:
 *   - docs/module-design/coaching-v2.md §4.2 接口契约
 *
 * Mock 策略:
 *   - MSW (Mock Service Worker) 拦截 HTTP 请求（API 测试）
 *   - Mock hooks/stores 返回值（页面渲染测试）
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// ===========================================================================
// Part 1: API 层契约测试
// ===========================================================================

import {
  getPrivateStudents,
  getPrivateStudentDetail,
  addPrivateStudent,
  removePrivateStudent,
  getPrivateLessons,
  getPrivateLessonDetail,
  createPrivateLesson,
  updatePrivateLesson,
  cancelPrivateLessonV2,
  updatePrivateLessonTrainingContent,
  addPrivateLessonNote,
  getPrivateLessonNotes,
  addPrivateStudentNote,
  getPrivateStudentNotes,
  setPrivateStudentTags,
  getPrivateStudentTags,
} from '@web/features/coaching/api/private-student-api';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockVenue = {
  id: 'venue-uuid-1',
  name: '朝阳体育中心',
  address: '北京市朝阳区...',
};

const mockPrivateStudentListItem = {
  id: 'ps-uuid-1',
  studentId: 'student-uuid-1',
  nickname: '周小明',
  avatarUrl: null,
  isActive: true,
  lessonCount: 8,
  joinedAt: '2026-04-01T10:00:00.000Z',
};

const mockPrivateStudentDetail = {
  id: 'ps-uuid-1',
  coachId: 'coach-uuid-1',
  studentId: 'student-uuid-1',
  nickname: '周小明',
  avatarUrl: null,
  isActive: true,
  lessonCount: 8,
  joinedAt: '2026-04-01T10:00:00.000Z',
};

const mockPrivateLessonListItem = {
  id: 'pl-uuid-1',
  venue: mockVenue,
  startTime: '2026-04-15T14:00:00.000Z',
  endTime: '2026-04-15T16:00:00.000Z',
  trainingContent: '反手技术训练',
  status: 'completed',
  createdAt: '2026-04-13T10:00:00.000Z',
};

const mockPrivateLessonDetail = {
  id: 'pl-uuid-1',
  privateStudentId: 'ps-uuid-1',
  coachId: 'coach-uuid-1',
  studentId: 'student-uuid-1',
  venue: mockVenue,
  startTime: '2026-04-15T14:00:00.000Z',
  endTime: '2026-04-15T16:00:00.000Z',
  trainingContent: '反手技术训练',
  status: 'completed',
  createdAt: '2026-04-13T10:00:00.000Z',
};

const mockLessonNote = {
  id: 'ln-uuid-1',
  content: '今天反手有明显进步',
  createdAt: '2026-04-15T16:30:00.000Z',
};

const mockStudentNote = {
  id: 'sn-uuid-1',
  content: '整体技术水平中上',
  createdAt: '2026-04-15T16:30:00.000Z',
};

// ===========================================================================
// API Tests
// ===========================================================================

describe('Private Student API', () => {
  // -------------------------------------------------------------------------
  // GET /api/private-students
  // -------------------------------------------------------------------------
  describe('getPrivateStudents', () => {
    // 来源: coaching-v2.md §4.2 — GET /api/private-students
    it('should fetch private students list', async () => {
      server.use(
        http.get('/api/private-students', () => {
          return HttpResponse.json({
            data: { items: [mockPrivateStudentListItem] },
          });
        }),
      );

      const result = await getPrivateStudents();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('ps-uuid-1');
      expect(result.items[0].nickname).toBe('周小明');
      expect(result.items[0].lessonCount).toBe(8);
      expect(result.items[0].isActive).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/private-students/:id
  // -------------------------------------------------------------------------
  describe('getPrivateStudentDetail', () => {
    // 来源: coaching-v2.md §4.2 — GET /api/private-students/:id
    it('should fetch private student detail', async () => {
      server.use(
        http.get('/api/private-students/ps-uuid-1', () => {
          return HttpResponse.json({ data: mockPrivateStudentDetail });
        }),
      );

      const result = await getPrivateStudentDetail('ps-uuid-1');
      expect(result.id).toBe('ps-uuid-1');
      expect(result.coachId).toBe('coach-uuid-1');
      expect(result.studentId).toBe('student-uuid-1');
      expect(result.nickname).toBe('周小明');
      expect(result.isActive).toBe(true);
    });

    // 来源: coaching-v2.md §4.2 — GET /api/private-students/:id — 错误码 404
    it('should throw on 404 error', async () => {
      server.use(
        http.get('/api/private-students/not-found', () => {
          return HttpResponse.json(
            { error: { code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND', message: '固定私教学员记录不存在' } },
            { status: 404 },
          );
        }),
      );

      await expect(getPrivateStudentDetail('not-found')).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/private-students
  // -------------------------------------------------------------------------
  describe('addPrivateStudent', () => {
    // 来源: coaching-v2.md §4.2 — POST /api/private-students
    it('should add a private student with studentId in body', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post('/api/private-students', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            {
              data: {
                id: 'ps-uuid-new',
                coachId: 'coach-uuid-1',
                studentId: 'student-uuid-2',
                nickname: '新学员',
                avatarUrl: null,
                isActive: true,
                joinedAt: '2026-04-13T10:00:00.000Z',
              },
            },
            { status: 201 },
          );
        }),
      );

      const result = await addPrivateStudent('student-uuid-2');
      expect(capturedBody).toEqual({ studentId: 'student-uuid-2' });
      expect(result.id).toBe('ps-uuid-new');
      expect(result.studentId).toBe('student-uuid-2');
    });

    // 来源: coaching-v2.md §4.2 — POST /api/private-students — 错误码 409
    it('should throw on duplicate student', async () => {
      server.use(
        http.post('/api/private-students', () => {
          return HttpResponse.json(
            { error: { code: 'COACHING_STUDENT_ALREADY_PRIVATE', message: '学员已是该教练的活跃固定私教学员' } },
            { status: 409 },
          );
        }),
      );

      await expect(addPrivateStudent('student-uuid-1')).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/private-students/:id
  // -------------------------------------------------------------------------
  describe('removePrivateStudent', () => {
    // 来源: coaching-v2.md §4.2 — DELETE /api/private-students/:id
    it('should remove (soft delete) a private student', async () => {
      server.use(
        http.delete('/api/private-students/ps-uuid-1', () => {
          return HttpResponse.json({
            data: { id: 'ps-uuid-1', isActive: false },
          });
        }),
      );

      const result = await removePrivateStudent('ps-uuid-1');
      expect(result.id).toBe('ps-uuid-1');
      expect(result.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/private-students/:id/lessons
  // -------------------------------------------------------------------------
  describe('getPrivateLessons', () => {
    // 来源: coaching-v2.md §4.2 — GET /api/private-students/:id/lessons
    it('should fetch lessons list for a private student', async () => {
      server.use(
        http.get('/api/private-students/ps-uuid-1/lessons', () => {
          return HttpResponse.json({
            data: { items: [mockPrivateLessonListItem] },
          });
        }),
      );

      const result = await getPrivateLessons('ps-uuid-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('pl-uuid-1');
      expect(result.items[0].status).toBe('completed');
    });

    // 来源: coaching-v2.md §4.2 — GET /api/private-students/:id/lessons — Query Params
    it('should pass status filter as query param', async () => {
      let capturedUrl = '';
      server.use(
        http.get('/api/private-students/ps-uuid-1/lessons', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ data: { items: [] } });
        }),
      );

      await getPrivateLessons('ps-uuid-1', { status: 'scheduled' });
      expect(capturedUrl).toContain('status=scheduled');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/private-students/:id/lessons/:lessonId
  // -------------------------------------------------------------------------
  describe('getPrivateLessonDetail', () => {
    // 来源: coaching-v2.md §4.2 — GET /api/private-students/:id/lessons/:lessonId
    it('should fetch lesson detail', async () => {
      server.use(
        http.get('/api/private-students/ps-uuid-1/lessons/pl-uuid-1', () => {
          return HttpResponse.json({ data: mockPrivateLessonDetail });
        }),
      );

      const result = await getPrivateLessonDetail('ps-uuid-1', 'pl-uuid-1');
      expect(result.id).toBe('pl-uuid-1');
      expect(result.privateStudentId).toBe('ps-uuid-1');
      expect(result.venue?.name).toBe('朝阳体育中心');
      expect(result.trainingContent).toBe('反手技术训练');
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/private-students/:id/lessons
  // -------------------------------------------------------------------------
  describe('createPrivateLesson', () => {
    // 来源: coaching-v2.md §4.2 — POST /api/private-students/:id/lessons
    it('should create a lesson with correct request body', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post('/api/private-students/ps-uuid-1/lessons', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            { data: { ...mockPrivateLessonDetail, status: 'scheduled' } },
            { status: 201 },
          );
        }),
      );

      const input = {
        startTime: '2026-04-18T14:00:00.000Z',
        endTime: '2026-04-18T16:00:00.000Z',
        venueId: 'venue-uuid-1',
        trainingContent: '杀球训练',
      };

      const result = await createPrivateLesson('ps-uuid-1', input);
      expect(capturedBody).toEqual(input);
      expect(result.id).toBe('pl-uuid-1');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/private-students/:id/lessons/:lessonId
  // -------------------------------------------------------------------------
  describe('updatePrivateLesson', () => {
    // 来源: coaching-v2.md §4.2 — PUT /api/private-students/:id/lessons/:lessonId
    it('should update lesson fields', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put('/api/private-students/ps-uuid-1/lessons/pl-uuid-1', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            data: { ...mockPrivateLessonDetail, startTime: '2026-04-16T14:00:00.000Z' },
          });
        }),
      );

      await updatePrivateLesson('ps-uuid-1', 'pl-uuid-1', {
        startTime: '2026-04-16T14:00:00.000Z',
      });
      expect(capturedBody).toEqual({ startTime: '2026-04-16T14:00:00.000Z' });
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/private-students/:id/lessons/:lessonId/cancel
  // -------------------------------------------------------------------------
  describe('cancelPrivateLessonV2', () => {
    // 来源: coaching-v2.md §4.2 — POST /api/private-students/:id/lessons/:lessonId/cancel
    it('should cancel a lesson', async () => {
      server.use(
        http.post('/api/private-students/ps-uuid-1/lessons/pl-uuid-1/cancel', () => {
          return HttpResponse.json({
            data: { id: 'pl-uuid-1', status: 'cancelled' },
          });
        }),
      );

      const result = await cancelPrivateLessonV2('ps-uuid-1', 'pl-uuid-1');
      expect(result.id).toBe('pl-uuid-1');
      expect(result.status).toBe('cancelled');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/private-students/:id/lessons/:lessonId/training-content
  // -------------------------------------------------------------------------
  describe('updatePrivateLessonTrainingContent', () => {
    // 来源: coaching-v2.md §4.2 — PUT /api/private-students/:id/lessons/:lessonId/training-content
    it('should update training content', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(
          '/api/private-students/ps-uuid-1/lessons/pl-uuid-1/training-content',
          async ({ request }) => {
            capturedBody = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({
              data: {
                id: 'pl-uuid-1',
                trainingContent: '更新后的训练内容',
                updatedAt: '2026-04-14T10:00:00.000Z',
              },
            });
          },
        ),
      );

      const result = await updatePrivateLessonTrainingContent('ps-uuid-1', 'pl-uuid-1', '更新后的训练内容');
      expect(capturedBody).toEqual({ trainingContent: '更新后的训练内容' });
      expect(result.trainingContent).toBe('更新后的训练内容');
    });
  });

  // -------------------------------------------------------------------------
  // POST/GET /api/private-students/:id/lessons/:lessonId/notes
  // -------------------------------------------------------------------------
  describe('lesson notes', () => {
    // 来源: coaching-v2.md §4.2 — POST /api/private-students/:id/lessons/:lessonId/notes
    it('addPrivateLessonNote should send content in body', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(
          '/api/private-students/ps-uuid-1/lessons/pl-uuid-1/notes',
          async ({ request }) => {
            capturedBody = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ data: mockLessonNote }, { status: 201 });
          },
        ),
      );

      const result = await addPrivateLessonNote('ps-uuid-1', 'pl-uuid-1', '今天反手有明显进步');
      expect(capturedBody).toEqual({ content: '今天反手有明显进步' });
      expect(result.id).toBe('ln-uuid-1');
    });

    // 来源: coaching-v2.md §4.2 — GET /api/private-students/:id/lessons/:lessonId/notes
    it('getPrivateLessonNotes should return items array', async () => {
      server.use(
        http.get(
          '/api/private-students/ps-uuid-1/lessons/pl-uuid-1/notes',
          () => {
            return HttpResponse.json({
              data: { items: [mockLessonNote] },
            });
          },
        ),
      );

      const result = await getPrivateLessonNotes('ps-uuid-1', 'pl-uuid-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].content).toBe('今天反手有明显进步');
    });
  });

  // -------------------------------------------------------------------------
  // POST/GET /api/private-students/:id/notes
  // -------------------------------------------------------------------------
  describe('student notes', () => {
    // 来源: coaching-v2.md §4.2 — POST /api/private-students/:id/notes
    it('addPrivateStudentNote should send content in body', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(
          '/api/private-students/ps-uuid-1/notes',
          async ({ request }) => {
            capturedBody = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ data: mockStudentNote }, { status: 201 });
          },
        ),
      );

      const result = await addPrivateStudentNote('ps-uuid-1', '整体技术水平中上');
      expect(capturedBody).toEqual({ content: '整体技术水平中上' });
      expect(result.id).toBe('sn-uuid-1');
    });

    // 来源: coaching-v2.md §4.2 — GET /api/private-students/:id/notes
    it('getPrivateStudentNotes should return items array', async () => {
      server.use(
        http.get('/api/private-students/ps-uuid-1/notes', () => {
          return HttpResponse.json({
            data: { items: [mockStudentNote] },
          });
        }),
      );

      const result = await getPrivateStudentNotes('ps-uuid-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].content).toBe('整体技术水平中上');
    });
  });

  // -------------------------------------------------------------------------
  // PUT/GET /api/private-students/:id/tags
  // -------------------------------------------------------------------------
  describe('student tags', () => {
    // 来源: coaching-v2.md §4.2 — PUT /api/private-students/:id/tags
    it('setPrivateStudentTags should send tags array', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put('/api/private-students/ps-uuid-1/tags', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            data: { tags: ['右手', '防守型', '体能好'] },
          });
        }),
      );

      const result = await setPrivateStudentTags('ps-uuid-1', ['右手', '防守型', '体能好']);
      expect(capturedBody).toEqual({ tags: ['右手', '防守型', '体能好'] });
      expect(result.tags).toEqual(['右手', '防守型', '体能好']);
    });

    // 来源: coaching-v2.md §4.2 — GET /api/private-students/:id/tags
    it('getPrivateStudentTags should return tags array', async () => {
      server.use(
        http.get('/api/private-students/ps-uuid-1/tags', () => {
          return HttpResponse.json({
            data: { tags: ['右手', '防守型'] },
          });
        }),
      );

      const result = await getPrivateStudentTags('ps-uuid-1');
      expect(result.tags).toEqual(['右手', '防守型']);
    });
  });
});

// ===========================================================================
// Part 2: 页面渲染测试
// ===========================================================================

// ---------------------------------------------------------------------------
// Mock Modules (for page tests)
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'ps-uuid-1', lessonId: 'pl-uuid-1' }),
  };
});

// Mock authStore
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: 'coach-uuid-1',
      isLoggedIn: true,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// Mock useCurrentUser
let mockCurrentUserState = {
  data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' } as unknown,
  isLoading: false,
};

vi.mock('@web/shared/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUserState,
}));

// Mock TanStack Query
const mockQueryClient = {
  invalidateQueries: vi.fn(),
};

let mockQueryStates: Record<string, { data: unknown; isLoading: boolean; error: unknown }> = {};
let mockMutationStates: Record<string, { mutate: ReturnType<typeof vi.fn>; isPending: boolean }> = {};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
    useQuery: ({ queryKey }: { queryKey: string[] }) => {
      const key = queryKey.join('/');
      return mockQueryStates[key] || { data: undefined, isLoading: false, error: null };
    },
    useMutation: ({ mutationFn }: { mutationFn: (...args: unknown[]) => Promise<unknown> }) => {
      // Use mutationFn name as key or a generic one
      const fnName = mutationFn.name || 'default';
      return mockMutationStates[fnName] || { mutate: vi.fn(), isPending: false };
    },
  };
});

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
  };
});

// Mock VenueSearchInput
vi.mock('@web/features/activity/components/venue-search-input', () => ({
  VenueSearchInput: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="venue-search-input">{placeholder}</div>
  ),
}));

// Mock DateTimePicker
vi.mock('@web/shared/components/DateTimePicker', () => ({
  DateTimePicker: ({ label }: { label?: string }) => (
    <div data-testid="date-time-picker">{label}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Import components under test (after mocks)
// ---------------------------------------------------------------------------

import { PrivateStudentListPage } from '@web/features/coaching/pages/PrivateStudentListPage';
import { PrivateStudentDetailPage } from '@web/features/coaching/pages/PrivateStudentDetailPage';
import { PrivateLessonDetailPage } from '@web/features/coaching/pages/PrivateLessonDetailPage';

// ---------------------------------------------------------------------------
// Page Test Fixtures
// ---------------------------------------------------------------------------

const pageFixtures = {
  studentList: {
    items: [
      {
        id: 'ps-uuid-1',
        studentId: 'student-uuid-1',
        nickname: '周小明',
        avatarUrl: null,
        isActive: true,
        lessonCount: 8,
        joinedAt: '2026-04-01T10:00:00.000Z',
      },
      {
        id: 'ps-uuid-2',
        studentId: 'student-uuid-2',
        nickname: '孙丽华',
        avatarUrl: null,
        isActive: true,
        lessonCount: 12,
        joinedAt: '2026-03-15T10:00:00.000Z',
      },
    ],
  },
  studentDetail: {
    id: 'ps-uuid-1',
    coachId: 'coach-uuid-1',
    studentId: 'student-uuid-1',
    nickname: '周小明',
    avatarUrl: null,
    isActive: true,
    lessonCount: 8,
    joinedAt: '2026-04-01T10:00:00.000Z',
  },
  lessonList: {
    items: [
      {
        id: 'pl-uuid-1',
        venue: mockVenue,
        startTime: '2026-04-15T14:00:00.000Z',
        endTime: '2026-04-15T16:00:00.000Z',
        trainingContent: '反手技术训练',
        status: 'completed',
        createdAt: '2026-04-13T10:00:00.000Z',
      },
      {
        id: 'pl-uuid-2',
        venue: mockVenue,
        startTime: '2026-04-20T14:00:00.000Z',
        endTime: '2026-04-20T16:00:00.000Z',
        trainingContent: '杀球力量训练',
        status: 'scheduled',
        createdAt: '2026-04-14T10:00:00.000Z',
      },
    ],
  },
  notesList: {
    items: [
      { id: 'sn-uuid-1', content: '整体水平中上', createdAt: '2026-04-15T16:30:00.000Z' },
      { id: 'sn-uuid-2', content: '需要加强体能', createdAt: '2026-04-14T16:00:00.000Z' },
    ],
  },
  tags: { tags: ['进攻型', '单打'] },
  lessonDetail: {
    id: 'pl-uuid-1',
    privateStudentId: 'ps-uuid-1',
    coachId: 'coach-uuid-1',
    studentId: 'student-uuid-1',
    venue: mockVenue,
    startTime: '2026-04-15T14:00:00.000Z',
    endTime: '2026-04-15T16:00:00.000Z',
    trainingContent: '反手技术训练',
    status: 'completed',
    createdAt: '2026-04-13T10:00:00.000Z',
  },
  lessonNotes: {
    items: [
      { id: 'ln-uuid-1', content: '今天反手进步明显', createdAt: '2026-04-15T16:30:00.000Z' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Page Rendering Tests
// ---------------------------------------------------------------------------

describe('PrivateStudentListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserState = {
      data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' },
      isLoading: false,
    };
    mockQueryStates = {};
    mockMutationStates = {};
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员列表页
  it('should render page title', () => {
    mockQueryStates['private-students'] = {
      data: pageFixtures.studentList,
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentListPage />);
    expect(screen.getByText('我的私教学员')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员列表页 — 空状态
  it('should show empty state when no students', () => {
    mockQueryStates['private-students'] = {
      data: { items: [] },
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentListPage />);
    expect(screen.getByText('暂无私教学员')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员列表页 — 学员卡片
  it('should render student cards with nicknames and lesson counts', () => {
    mockQueryStates['private-students'] = {
      data: pageFixtures.studentList,
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentListPage />);
    expect(screen.getByText('周小明')).toBeInTheDocument();
    expect(screen.getByText('孙丽华')).toBeInTheDocument();
    expect(screen.getByText('已上 8 节课')).toBeInTheDocument();
    expect(screen.getByText('已上 12 节课')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员列表页 — FAB 按钮
  it('should render FAB button for adding students', () => {
    mockQueryStates['private-students'] = {
      data: { items: [] },
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentListPage />);
    expect(screen.getByTestId('add-private-student-fab')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员列表页 — 加载中
  it('should show loading when data is loading', () => {
    mockQueryStates['private-students'] = {
      data: undefined,
      isLoading: true,
      error: null,
    };

    render(<PrivateStudentListPage />);
    expect(screen.getAllByText(/加载中/i).length).toBeGreaterThan(0);
  });

  // 来源: coaching-v2.md 附录 B.1 — 教练权限校验
  it('should show coach guard when user is not a coach', () => {
    mockCurrentUserState = {
      data: { id: 'user-uuid-1', isCoach: false, nickname: '普通用户' },
      isLoading: false,
    };

    render(<PrivateStudentListPage />);
    expect(screen.getByText('请先开启教练角色')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 添加学员弹窗
  it('should open add student modal on FAB click', async () => {
    const user = userEvent.setup();
    mockQueryStates['private-students'] = {
      data: { items: [] },
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentListPage />);
    await user.click(screen.getByTestId('add-private-student-fab'));
    expect(screen.getByText('添加私教学员')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('输入昵称、手机号或手机号后 4 位'),
    ).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 点击学员卡片导航
  it('should navigate to student detail on card click', async () => {
    const user = userEvent.setup();
    mockQueryStates['private-students'] = {
      data: pageFixtures.studentList,
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentListPage />);
    await user.click(screen.getByTestId('private-student-ps-uuid-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/my-private-students/ps-uuid-1');
  });
});

describe('PrivateStudentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserState = {
      data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' },
      isLoading: false,
    };
    mockQueryStates = {
      'private-students/ps-uuid-1': {
        data: pageFixtures.studentDetail,
        isLoading: false,
        error: null,
      },
      'private-students/ps-uuid-1/lessons': {
        data: pageFixtures.lessonList,
        isLoading: false,
        error: null,
      },
      'private-students/ps-uuid-1/notes': {
        data: pageFixtures.notesList,
        isLoading: false,
        error: null,
      },
      'private-students/ps-uuid-1/tags': {
        data: pageFixtures.tags,
        isLoading: false,
        error: null,
      },
    };
    mockMutationStates = {};
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 学员头部
  it('should render student header with nickname', () => {
    render(<PrivateStudentDetailPage />);
    expect(screen.getByText('周小明')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 标签
  it('should render student tags', () => {
    render(<PrivateStudentDetailPage />);
    expect(screen.getByText('进攻型')).toBeInTheDocument();
    expect(screen.getByText('单打')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 统计行
  it('should render stats row with lesson count and note count', () => {
    render(<PrivateStudentDetailPage />);
    expect(screen.getByText('8')).toBeInTheDocument(); // lesson count
    expect(screen.getByText('已上课')).toBeInTheDocument();
    expect(screen.getByText('笔记')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 下节课卡片
  it('should render upcoming lesson card', () => {
    render(<PrivateStudentDetailPage />);
    // The upcoming lesson (status=scheduled) should show as "下节课"
    expect(screen.getByText('下节课')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-lesson')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 快速操作按钮
  it('should render quick action buttons for active student', () => {
    render(<PrivateStudentDetailPage />);
    expect(screen.getByTestId('create-lesson-btn')).toBeInTheDocument();
    expect(screen.getByTestId('write-note-btn')).toBeInTheDocument();
    expect(screen.getByTestId('record-match-btn')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 最近笔记
  it('should render recent notes', () => {
    render(<PrivateStudentDetailPage />);
    expect(screen.getByText('最近笔记')).toBeInTheDocument();
    expect(screen.getByText('整体水平中上')).toBeInTheDocument();
    expect(screen.getByText('需要加强体能')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 历史课程
  it('should render lesson history', () => {
    render(<PrivateStudentDetailPage />);
    expect(screen.getByText('历史课程')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 移除按钮
  it('should render remove button for active student', () => {
    render(<PrivateStudentDetailPage />);
    expect(screen.getByTestId('remove-student-btn')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 非活跃学员无移除按钮
  it('should not render remove button for inactive student', () => {
    mockQueryStates['private-students/ps-uuid-1'] = {
      data: { ...pageFixtures.studentDetail, isActive: false },
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentDetailPage />);
    expect(screen.queryByTestId('remove-student-btn')).not.toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教学员详情页 — 非活跃学员无快速操作按钮
  it('should not render quick action buttons for inactive student', () => {
    mockQueryStates['private-students/ps-uuid-1'] = {
      data: { ...pageFixtures.studentDetail, isActive: false },
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentDetailPage />);
    expect(screen.queryByTestId('create-lesson-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('write-note-btn')).not.toBeInTheDocument();
  });

  // 来源: coaching-v2.md §4.2 — DELETE /api/private-students/:id — 二次确认
  it('should show remove confirmation on remove button click', async () => {
    const user = userEvent.setup();
    render(<PrivateStudentDetailPage />);
    await user.click(screen.getByTestId('remove-student-btn'));
    expect(screen.getByText(/确定移除该私教学员/)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-remove-btn')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 写笔记弹窗
  it('should open note modal on write note button click', async () => {
    const user = userEvent.setup();
    render(<PrivateStudentDetailPage />);
    await user.click(screen.getByTestId('write-note-btn'));
    expect(screen.getByText('添加学员笔记')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/输入笔记内容/)).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 创建课程弹窗
  it('should open create lesson modal on create lesson button click', async () => {
    const user = userEvent.setup();
    render(<PrivateStudentDetailPage />);
    await user.click(screen.getByTestId('create-lesson-btn'));
    expect(screen.getByText('创建私教课程')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 点击课程导航到课程详情
  it('should navigate to lesson detail on lesson card click', async () => {
    const user = userEvent.setup();
    render(<PrivateStudentDetailPage />);
    await user.click(screen.getByTestId('lesson-pl-uuid-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/my-private-students/ps-uuid-1/lessons/pl-uuid-1');
  });

  // 来源: coaching-v2.md 附录 B.1 — 教练权限
  it('should show coach guard for non-coach user', () => {
    mockCurrentUserState = {
      data: { id: 'user-uuid-1', isCoach: false, nickname: '普通用户' },
      isLoading: false,
    };

    render(<PrivateStudentDetailPage />);
    expect(screen.getByText('请先开启教练角色')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 学员不存在
  it('should show not found when student detail is null', () => {
    mockQueryStates['private-students/ps-uuid-1'] = {
      data: null,
      isLoading: false,
      error: null,
    };

    render(<PrivateStudentDetailPage />);
    expect(screen.getByText('学员不存在')).toBeInTheDocument();
  });
});

describe('PrivateLessonDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserState = {
      data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' },
      isLoading: false,
    };
    mockQueryStates = {
      'private-students/ps-uuid-1/lessons/pl-uuid-1': {
        data: pageFixtures.lessonDetail,
        isLoading: false,
        error: null,
      },
      'private-students/ps-uuid-1/lessons/pl-uuid-1/notes': {
        data: pageFixtures.lessonNotes,
        isLoading: false,
        error: null,
      },
    };
    mockMutationStates = {};
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教课程详情页 — 课程信息
  it('should render lesson detail with status badge', () => {
    render(<PrivateLessonDetailPage />);
    expect(screen.getByText('课程详情')).toBeInTheDocument();
    expect(screen.getByText('已结束')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教课程详情页 — 场馆名称
  it('should render venue name', () => {
    render(<PrivateLessonDetailPage />);
    expect(screen.getByText('朝阳体育中心')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教课程详情页 — 训练内容
  it('should render training content', () => {
    render(<PrivateLessonDetailPage />);
    expect(screen.getByText('反手技术训练')).toBeInTheDocument();
    // Should have edit button for non-cancelled lesson
    expect(screen.getByTestId('edit-training-btn')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教课程详情页 — 课程笔记
  it('should render lesson notes', () => {
    render(<PrivateLessonDetailPage />);
    expect(screen.getByText('课程笔记')).toBeInTheDocument();
    expect(screen.getByText('今天反手进步明显')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 固定私教课程详情页 — 添加笔记按钮
  it('should render add note button for non-cancelled lesson', () => {
    render(<PrivateLessonDetailPage />);
    expect(screen.getByTestId('add-lesson-note-btn')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md §4.2 — 战绩录入 — 仅 in_progress/completed 可录入
  it('should render record match button for completed lesson', () => {
    render(<PrivateLessonDetailPage />);
    expect(screen.getByTestId('record-lesson-match-btn')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md §4.2 — POST /cancel — scheduled 课程才显示取消按钮
  it('should render cancel button for scheduled lesson', () => {
    mockQueryStates['private-students/ps-uuid-1/lessons/pl-uuid-1'] = {
      data: { ...pageFixtures.lessonDetail, status: 'scheduled' },
      isLoading: false,
      error: null,
    };

    render(<PrivateLessonDetailPage />);
    expect(screen.getByTestId('cancel-lesson-btn')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md §4.2 — 取消确认弹窗
  it('should show cancel confirmation on cancel button click', async () => {
    const user = userEvent.setup();
    mockQueryStates['private-students/ps-uuid-1/lessons/pl-uuid-1'] = {
      data: { ...pageFixtures.lessonDetail, status: 'scheduled' },
      isLoading: false,
      error: null,
    };

    render(<PrivateLessonDetailPage />);
    await user.click(screen.getByTestId('cancel-lesson-btn'));
    expect(screen.getByText(/确定取消该课程/)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-cancel-lesson-btn')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md §4.2 — completed lesson 不显示取消按钮
  it('should not render cancel button for completed lesson', () => {
    render(<PrivateLessonDetailPage />);
    expect(screen.queryByTestId('cancel-lesson-btn')).not.toBeInTheDocument();
  });

  // 来源: coaching-v2.md §4.2 — cancelled 课程不显示编辑训练内容按钮
  it('should not render edit training button for cancelled lesson', () => {
    mockQueryStates['private-students/ps-uuid-1/lessons/pl-uuid-1'] = {
      data: { ...pageFixtures.lessonDetail, status: 'cancelled' },
      isLoading: false,
      error: null,
    };

    render(<PrivateLessonDetailPage />);
    expect(screen.queryByTestId('edit-training-btn')).not.toBeInTheDocument();
  });

  // 来源: coaching-v2.md §4.2 — cancelled 课程不显示添加笔记按钮
  it('should not render add note button for cancelled lesson', () => {
    mockQueryStates['private-students/ps-uuid-1/lessons/pl-uuid-1'] = {
      data: { ...pageFixtures.lessonDetail, status: 'cancelled' },
      isLoading: false,
      error: null,
    };

    render(<PrivateLessonDetailPage />);
    expect(screen.queryByTestId('add-lesson-note-btn')).not.toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 课程不存在
  it('should show not found when lesson detail is null', () => {
    mockQueryStates['private-students/ps-uuid-1/lessons/pl-uuid-1'] = {
      data: null,
      isLoading: false,
      error: null,
    };

    render(<PrivateLessonDetailPage />);
    expect(screen.getByText('课程不存在')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 加载中
  it('should show loading state', () => {
    mockQueryStates['private-students/ps-uuid-1/lessons/pl-uuid-1'] = {
      data: undefined,
      isLoading: true,
      error: null,
    };

    render(<PrivateLessonDetailPage />);
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 添加课程笔记弹窗
  it('should open note modal on add note button click', async () => {
    const user = userEvent.setup();
    render(<PrivateLessonDetailPage />);
    await user.click(screen.getByTestId('add-lesson-note-btn'));
    expect(screen.getByText('添加课程笔记')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/输入笔记内容/)).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 点击编辑训练内容进入编辑模式
  it('should enter training content edit mode on edit button click', async () => {
    const user = userEvent.setup();
    render(<PrivateLessonDetailPage />);
    await user.click(screen.getByTestId('edit-training-btn'));
    // Should show a textarea (via the save/cancel buttons)
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 教练权限
  it('should show coach guard for non-coach user', () => {
    mockCurrentUserState = {
      data: { id: 'user-uuid-1', isCoach: false, nickname: '普通用户' },
      isLoading: false,
    };

    render(<PrivateLessonDetailPage />);
    expect(screen.getByText('请先开启教练角色')).toBeInTheDocument();
  });

  // 来源: coaching-v2.md §4.2 — 战绩录入导航
  it('should navigate to match record creation with source params', async () => {
    const user = userEvent.setup();
    render(<PrivateLessonDetailPage />);
    await user.click(screen.getByTestId('record-lesson-match-btn'));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/match-records/create?sourceType=private_lesson_v2&sourceId=pl-uuid-1',
    );
  });
});
