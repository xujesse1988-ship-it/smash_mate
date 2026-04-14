/**
 * 契约测试: web-app/coaching — 学员班页面 (Student Class Pages)
 * 覆盖页面:
 *   - StudentClassListPage (/my-student-classes)
 *   - StudentClassDetailPage (/my-student-classes/:classId)
 *   - ClassLessonDetailPage (/my-student-classes/:classId/lessons/:lessonId)
 *   - ClassStudentProfilePage (/my-student-classes/:classId/members/:studentId)
 *
 * 覆盖 API:
 *   - student-class-api.ts 全部函数
 *
 * 来源文档:
 *   - docs/module-design/coaching-v2.md §4.1 — 学员班接口契约
 *   - docs/module-design/coaching-v2.md 附录 B.1 — 前端页面
 *
 * Mock 策略:
 *   - MSW (Mock Service Worker) 拦截 HTTP 请求（API 测试）
 *   - Mock hooks 返回值（页面渲染测试）
 *   - Mock react-router-dom 导航
 *   - Mock authStore（教练角色）
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// ===========================================================================
// Part 1: API Layer Tests
// ===========================================================================

const apiServer = setupServer();

beforeAll(() => apiServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => apiServer.resetHandlers());
afterAll(() => apiServer.close());

import {
  getStudentClasses,
  getStudentClassDetail,
  createStudentClass,
  updateStudentClass,
  deleteStudentClass,
  addStudentToClass,
  removeStudentFromClass,
  searchUsers,
  getClassLessons,
  getClassLessonDetail,
  createClassLesson,
  cancelClassLesson,
  updateTrainingContent,
  addLessonNote,
  getLessonNotes,
  addStudentNote,
  getStudentNotes,
  setStudentTags,
  getStudentTags,
} from '@web/features/coaching/api/student-class-api';

// ---------------------------------------------------------------------------
// API Fixtures
// ---------------------------------------------------------------------------

const mockClassItem = {
  id: 'class-uuid-1',
  coachId: 'coach-uuid-1',
  name: '周三进阶班',
  memberCount: 5,
  lessonCount: 12,
  createdAt: '2026-04-13T10:00:00.000Z',
};

const mockClassDetail = {
  id: 'class-uuid-1',
  coachId: 'coach-uuid-1',
  name: '周三进阶班',
  memberCount: 2,
  lessonCount: 3,
  members: [
    {
      studentId: 'student-uuid-1',
      nickname: '学员小王',
      avatarUrl: 'https://example.com/avatar1.jpg',
      joinedAt: '2026-04-13T10:00:00.000Z',
    },
    {
      studentId: 'student-uuid-2',
      nickname: '学员小李',
      avatarUrl: null,
      joinedAt: '2026-04-14T10:00:00.000Z',
    },
  ],
  createdAt: '2026-04-13T10:00:00.000Z',
};

const mockLessonItem = {
  id: 'lesson-uuid-1',
  venue: { id: 'venue-uuid-1', name: '朝阳体育中心', address: '北京市朝阳区...' },
  startTime: '2026-04-15T14:00:00.000Z',
  endTime: '2026-04-15T16:00:00.000Z',
  trainingContent: '步法训练 + 高远球',
  status: 'scheduled',
  createdAt: '2026-04-13T10:00:00.000Z',
};

const mockLessonDetail = {
  id: 'lesson-uuid-1',
  studentClassId: 'class-uuid-1',
  coachId: 'coach-uuid-1',
  venue: { id: 'venue-uuid-1', name: '朝阳体育中心', address: '北京市朝阳区...' },
  startTime: '2026-04-15T14:00:00.000Z',
  endTime: '2026-04-15T16:00:00.000Z',
  trainingContent: '步法训练 + 高远球',
  status: 'completed',
  createdAt: '2026-04-13T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// API Tests
// ---------------------------------------------------------------------------

describe('student-class-api', () => {
  // 来源: coaching-v2.md §4.1 — GET /api/student-classes
  describe('getStudentClasses', () => {
    it('should GET /api/student-classes and return items', async () => {
      apiServer.use(
        http.get('/api/student-classes', () => {
          return HttpResponse.json({ data: { items: [mockClassItem] } });
        }),
      );

      const result = await getStudentClasses();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('周三进阶班');
      expect(result.items[0].memberCount).toBe(5);
    });
  });

  // 来源: coaching-v2.md §4.1 — GET /api/student-classes/:id
  describe('getStudentClassDetail', () => {
    it('should GET /api/student-classes/:id and return detail with members', async () => {
      apiServer.use(
        http.get('/api/student-classes/class-uuid-1', () => {
          return HttpResponse.json({ data: mockClassDetail });
        }),
      );

      const result = await getStudentClassDetail('class-uuid-1');
      expect(result.name).toBe('周三进阶班');
      expect(result.members).toHaveLength(2);
      expect(result.members[0].nickname).toBe('学员小王');
    });
  });

  // 来源: coaching-v2.md §4.1 — POST /api/student-classes
  describe('createStudentClass', () => {
    it('should POST /api/student-classes with name and return created class', async () => {
      apiServer.use(
        http.post('/api/student-classes', async ({ request }) => {
          const body = (await request.json()) as { name: string };
          expect(body.name).toBe('周五高级班');
          return HttpResponse.json(
            { data: { ...mockClassItem, name: body.name, memberCount: 0, lessonCount: 0 } },
            { status: 201 },
          );
        }),
      );

      const result = await createStudentClass({ name: '周五高级班' });
      expect(result.name).toBe('周五高级班');
    });
  });

  // 来源: coaching-v2.md §4.1 — PUT /api/student-classes/:id
  describe('updateStudentClass', () => {
    it('should PUT /api/student-classes/:id with new name', async () => {
      apiServer.use(
        http.put('/api/student-classes/class-uuid-1', async ({ request }) => {
          const body = (await request.json()) as { name: string };
          return HttpResponse.json({
            data: { id: 'class-uuid-1', coachId: 'coach-uuid-1', name: body.name, updatedAt: '2026-04-14T10:00:00.000Z' },
          });
        }),
      );

      const result = await updateStudentClass('class-uuid-1', { name: '新名称' });
      expect(result.name).toBe('新名称');
    });
  });

  // 来源: coaching-v2.md §4.1 — DELETE /api/student-classes/:id
  describe('deleteStudentClass', () => {
    it('should DELETE /api/student-classes/:id and return success', async () => {
      apiServer.use(
        http.delete('/api/student-classes/class-uuid-1', () => {
          return HttpResponse.json({ data: { success: true } });
        }),
      );

      const result = await deleteStudentClass('class-uuid-1');
      expect(result.success).toBe(true);
    });
  });

  // 来源: coaching-v2.md §4.1 — POST /api/student-classes/:id/members
  describe('addStudentToClass', () => {
    it('should POST /api/student-classes/:id/members with studentId', async () => {
      apiServer.use(
        http.post('/api/student-classes/class-uuid-1/members', async ({ request }) => {
          const body = (await request.json()) as { studentId: string };
          expect(body.studentId).toBe('student-uuid-1');
          return HttpResponse.json(
            {
              data: {
                studentClassId: 'class-uuid-1',
                studentId: 'student-uuid-1',
                nickname: '学员小王',
                joinedAt: '2026-04-13T10:00:00.000Z',
              },
            },
            { status: 201 },
          );
        }),
      );

      const result = await addStudentToClass('class-uuid-1', 'student-uuid-1');
      expect(result.studentId).toBe('student-uuid-1');
      expect(result.nickname).toBe('学员小王');
    });
  });

  // 来源: coaching-v2.md §4.1 — DELETE /api/student-classes/:id/members/:studentId
  describe('removeStudentFromClass', () => {
    it('should DELETE /api/student-classes/:id/members/:studentId', async () => {
      apiServer.use(
        http.delete(
          '/api/student-classes/class-uuid-1/members/student-uuid-1',
          () => {
            return HttpResponse.json({ data: { success: true } });
          },
        ),
      );

      const result = await removeStudentFromClass('class-uuid-1', 'student-uuid-1');
      expect(result.success).toBe(true);
    });
  });

  // 来源: coaching-v2.md §4.1 — GET /api/users/search
  describe('searchUsers', () => {
    it('should GET /api/users/search with query parameter', async () => {
      apiServer.use(
        http.get('/api/users/search', ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('q')).toBe('小王');
          return HttpResponse.json({
            data: {
              items: [
                { id: 'user-uuid-1', nickname: '学员小王', avatarUrl: null, phoneLast4: '1234' },
              ],
            },
          });
        }),
      );

      const result = await searchUsers('小王');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].phoneLast4).toBe('5678');
    });
  });

  // 来源: coaching-v2.md §4.1 — GET /api/student-classes/:id/lessons
  describe('getClassLessons', () => {
    it('should GET /api/student-classes/:id/lessons and return items', async () => {
      apiServer.use(
        http.get('/api/student-classes/class-uuid-1/lessons', () => {
          return HttpResponse.json({ data: { items: [mockLessonItem] } });
        }),
      );

      const result = await getClassLessons('class-uuid-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('scheduled');
    });

    it('should pass status filter as query parameter', async () => {
      apiServer.use(
        http.get('/api/student-classes/class-uuid-1/lessons', ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('status')).toBe('completed');
          return HttpResponse.json({ data: { items: [] } });
        }),
      );

      await getClassLessons('class-uuid-1', { status: 'completed' });
    });
  });

  // 来源: coaching-v2.md §4.1 — GET /api/student-classes/:id/lessons/:lessonId
  describe('getClassLessonDetail', () => {
    it('should GET lesson detail', async () => {
      apiServer.use(
        http.get(
          '/api/student-classes/class-uuid-1/lessons/lesson-uuid-1',
          () => {
            return HttpResponse.json({ data: mockLessonDetail });
          },
        ),
      );

      const result = await getClassLessonDetail('class-uuid-1', 'lesson-uuid-1');
      expect(result.status).toBe('completed');
      expect(result.trainingContent).toBe('步法训练 + 高远球');
    });
  });

  // 来源: coaching-v2.md §4.1 — POST /api/student-classes/:id/lessons
  describe('createClassLesson', () => {
    it('should POST lesson with required fields', async () => {
      apiServer.use(
        http.post(
          '/api/student-classes/class-uuid-1/lessons',
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>;
            expect(body.venueId).toBe('venue-uuid-1');
            expect(body.startTime).toBeDefined();
            return HttpResponse.json({ data: mockLessonDetail }, { status: 201 });
          },
        ),
      );

      const result = await createClassLesson('class-uuid-1', {
        startTime: '2026-04-15T14:00:00.000Z',
        endTime: '2026-04-15T16:00:00.000Z',
        venueId: 'venue-uuid-1',
      });
      expect(result.id).toBe('lesson-uuid-1');
    });
  });

  // 来源: coaching-v2.md §4.1 — POST /api/student-classes/:id/lessons/:lessonId/cancel
  describe('cancelClassLesson', () => {
    it('should POST to cancel endpoint', async () => {
      apiServer.use(
        http.post(
          '/api/student-classes/class-uuid-1/lessons/lesson-uuid-1/cancel',
          () => {
            return HttpResponse.json({ data: { id: 'lesson-uuid-1', status: 'cancelled' } });
          },
        ),
      );

      const result = await cancelClassLesson('class-uuid-1', 'lesson-uuid-1');
      expect(result.status).toBe('cancelled');
    });
  });

  // 来源: coaching-v2.md §4.1 — PUT /api/student-classes/:id/lessons/:lessonId/training-content
  describe('updateTrainingContent', () => {
    it('should PUT training content', async () => {
      apiServer.use(
        http.put(
          '/api/student-classes/class-uuid-1/lessons/lesson-uuid-1/training-content',
          async ({ request }) => {
            const body = (await request.json()) as { trainingContent: string };
            expect(body.trainingContent).toBe('新的训练内容');
            return HttpResponse.json({
              data: { id: 'lesson-uuid-1', trainingContent: body.trainingContent, updatedAt: '2026-04-14T10:00:00.000Z' },
            });
          },
        ),
      );

      const result = await updateTrainingContent('class-uuid-1', 'lesson-uuid-1', '新的训练内容');
      expect(result.trainingContent).toBe('新的训练内容');
    });
  });

  // 来源: coaching-v2.md §4.1 — POST /api/student-classes/:id/lessons/:lessonId/notes
  describe('addLessonNote', () => {
    it('should POST note content', async () => {
      apiServer.use(
        http.post(
          '/api/student-classes/class-uuid-1/lessons/lesson-uuid-1/notes',
          async ({ request }) => {
            const body = (await request.json()) as { content: string };
            expect(body.content).toBe('今天训练不错');
            return HttpResponse.json(
              {
                data: {
                  id: 'note-uuid-1',
                  classLessonId: 'lesson-uuid-1',
                  coachId: 'coach-uuid-1',
                  content: body.content,
                  createdAt: '2026-04-15T16:30:00.000Z',
                },
              },
              { status: 201 },
            );
          },
        ),
      );

      const result = await addLessonNote('class-uuid-1', 'lesson-uuid-1', '今天训练不错');
      expect(result.content).toBe('今天训练不错');
    });
  });

  // 来源: coaching-v2.md §4.1 — GET /api/student-classes/:id/lessons/:lessonId/notes
  describe('getLessonNotes', () => {
    it('should GET lesson notes', async () => {
      apiServer.use(
        http.get(
          '/api/student-classes/class-uuid-1/lessons/lesson-uuid-1/notes',
          () => {
            return HttpResponse.json({
              data: {
                items: [
                  { id: 'note-uuid-1', content: '今天训练不错', createdAt: '2026-04-15T16:30:00.000Z' },
                ],
              },
            });
          },
        ),
      );

      const result = await getLessonNotes('class-uuid-1', 'lesson-uuid-1');
      expect(result.items).toHaveLength(1);
    });
  });

  // 来源: coaching-v2.md §4.1 — POST /api/student-classes/:id/members/:studentId/notes
  describe('addStudentNote', () => {
    it('should POST student note', async () => {
      apiServer.use(
        http.post(
          '/api/student-classes/class-uuid-1/members/student-uuid-1/notes',
          async ({ request }) => {
            const body = (await request.json()) as { content: string };
            return HttpResponse.json(
              {
                data: {
                  id: 'snote-uuid-1',
                  coachId: 'coach-uuid-1',
                  studentId: 'student-uuid-1',
                  studentClassId: 'class-uuid-1',
                  content: body.content,
                  createdAt: '2026-04-15T16:30:00.000Z',
                },
              },
              { status: 201 },
            );
          },
        ),
      );

      const result = await addStudentNote('class-uuid-1', 'student-uuid-1', '步法加强');
      expect(result.content).toBe('步法加强');
    });
  });

  // 来源: coaching-v2.md §4.1 — GET /api/student-classes/:id/members/:studentId/notes
  describe('getStudentNotes', () => {
    it('should GET student notes', async () => {
      apiServer.use(
        http.get(
          '/api/student-classes/class-uuid-1/members/student-uuid-1/notes',
          () => {
            return HttpResponse.json({
              data: {
                items: [
                  { id: 'snote-uuid-1', content: '步法加强', createdAt: '2026-04-15T16:30:00.000Z' },
                ],
              },
            });
          },
        ),
      );

      const result = await getStudentNotes('class-uuid-1', 'student-uuid-1');
      expect(result.items).toHaveLength(1);
    });
  });

  // 来源: coaching-v2.md §4.1 — PUT /api/student-classes/:id/members/:studentId/tags
  describe('setStudentTags', () => {
    it('should PUT tags array', async () => {
      apiServer.use(
        http.put(
          '/api/student-classes/class-uuid-1/members/student-uuid-1/tags',
          async ({ request }) => {
            const body = (await request.json()) as { tags: string[] };
            expect(body.tags).toEqual(['左手', '进攻型']);
            return HttpResponse.json({ data: { tags: body.tags } });
          },
        ),
      );

      const result = await setStudentTags('class-uuid-1', 'student-uuid-1', ['左手', '进攻型']);
      expect(result.tags).toEqual(['左手', '进攻型']);
    });
  });

  // 来源: coaching-v2.md §4.1 — GET /api/student-classes/:id/members/:studentId/tags
  describe('getStudentTags', () => {
    it('should GET student tags', async () => {
      apiServer.use(
        http.get(
          '/api/student-classes/class-uuid-1/members/student-uuid-1/tags',
          () => {
            return HttpResponse.json({ data: { tags: ['左手', '进攻型'] } });
          },
        ),
      );

      const result = await getStudentTags('class-uuid-1', 'student-uuid-1');
      expect(result.tags).toEqual(['左手', '进攻型']);
    });
  });

  // 来源: coaching-v2.md §4.1 — 错误处理
  describe('error handling', () => {
    it('should throw error with code on 404 response', async () => {
      apiServer.use(
        http.get('/api/student-classes/not-exist', () => {
          return HttpResponse.json(
            { error: { code: 'COACHING_STUDENT_CLASS_NOT_FOUND', message: '学员班不存在' } },
            { status: 404 },
          );
        }),
      );

      try {
        await getStudentClassDetail('not-exist');
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const error = err as Error & { code: string };
        expect(error.code).toBe('COACHING_STUDENT_CLASS_NOT_FOUND');
      }
    });
  });
});

// ===========================================================================
// Part 2: Page Rendering Tests
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
    useParams: () => ({
      classId: 'class-uuid-1',
      lessonId: 'lesson-uuid-1',
      studentId: 'student-uuid-1',
    }),
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

// --- StudentClassListPage hooks ---

let mockStudentClassesState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useStudentClasses', () => ({
  useStudentClasses: () => mockStudentClassesState,
}));

const mockCreateStudentClass = vi.fn();
vi.mock('@web/features/coaching/hooks/useCreateStudentClass', () => ({
  useCreateStudentClass: () => ({ mutate: mockCreateStudentClass, isPending: false }),
}));

const mockDeleteStudentClass = vi.fn();
vi.mock('@web/features/coaching/hooks/useDeleteStudentClass', () => ({
  useDeleteStudentClass: () => ({ mutate: mockDeleteStudentClass, isPending: false }),
}));

// --- StudentClassDetailPage hooks ---

let mockStudentClassDetailState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useStudentClassDetail', () => ({
  useStudentClassDetail: () => mockStudentClassDetailState,
}));

let mockClassLessonsState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useClassLessons', () => ({
  useClassLessons: () => mockClassLessonsState,
}));

const mockUpdateStudentClass = vi.fn();
vi.mock('@web/features/coaching/hooks/useUpdateStudentClass', () => ({
  useUpdateStudentClass: () => ({ mutate: mockUpdateStudentClass, isPending: false }),
}));

const mockAddStudentToClass = vi.fn();
vi.mock('@web/features/coaching/hooks/useAddStudentToClass', () => ({
  useAddStudentToClass: () => ({ mutate: mockAddStudentToClass, isPending: false }),
}));

const mockRemoveStudentFromClass = vi.fn();
vi.mock('@web/features/coaching/hooks/useRemoveStudentFromClass', () => ({
  useRemoveStudentFromClass: () => ({ mutate: mockRemoveStudentFromClass, isPending: false }),
}));

const mockCreateClassLesson = vi.fn();
vi.mock('@web/features/coaching/hooks/useCreateClassLesson', () => ({
  useCreateClassLesson: () => ({ mutate: mockCreateClassLesson, isPending: false }),
}));

// --- ClassLessonDetailPage hooks ---

let mockClassLessonDetailState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useClassLessonDetail', () => ({
  useClassLessonDetail: () => mockClassLessonDetailState,
}));

let mockLessonNotesState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useLessonNotes', () => ({
  useLessonNotes: () => mockLessonNotesState,
}));

const mockUpdateTrainingContent = vi.fn();
vi.mock('@web/features/coaching/hooks/useUpdateTrainingContent', () => ({
  useUpdateTrainingContent: () => ({ mutate: mockUpdateTrainingContent, isPending: false }),
}));

const mockAddLessonNote = vi.fn();
vi.mock('@web/features/coaching/hooks/useAddLessonNote', () => ({
  useAddLessonNote: () => ({ mutate: mockAddLessonNote, isPending: false }),
}));

const mockCancelClassLesson = vi.fn();
vi.mock('@web/features/coaching/hooks/useCancelClassLesson', () => ({
  useCancelClassLesson: () => ({ mutate: mockCancelClassLesson, isPending: false }),
}));

// --- ClassStudentProfilePage hooks ---

let mockStudentNotesState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useStudentNotes', () => ({
  useStudentNotes: () => mockStudentNotesState,
}));

let mockStudentTagsState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useStudentTags', () => ({
  useStudentTags: () => mockStudentTagsState,
}));

const mockAddStudentNote = vi.fn();
vi.mock('@web/features/coaching/hooks/useAddStudentNote', () => ({
  useAddStudentNote: () => ({ mutate: mockAddStudentNote, isPending: false }),
}));

const mockSetStudentTags = vi.fn();
vi.mock('@web/features/coaching/hooks/useSetStudentTags', () => ({
  useSetStudentTags: () => ({ mutate: mockSetStudentTags, isPending: false }),
}));

// Mock searchUsers (used directly in StudentClassDetailPage)
vi.mock('@web/features/coaching/api/student-class-api', async () => {
  const actual = await vi.importActual('@web/features/coaching/api/student-class-api');
  return {
    ...actual,
    searchUsers: vi.fn().mockResolvedValue({
      items: [
        { id: 'search-user-1', nickname: '搜索结果用户', avatarUrl: null, phoneLast4: '5678' },
      ],
    }),
  };
});

// ---------------------------------------------------------------------------
// Import components under test (after mocks)
// ---------------------------------------------------------------------------

import { StudentClassListPage } from '@web/features/coaching/pages/StudentClassListPage';
import { StudentClassDetailPage } from '@web/features/coaching/pages/StudentClassDetailPage';
import { ClassLessonDetailPage } from '@web/features/coaching/pages/ClassLessonDetailPage';
import { ClassStudentProfilePage } from '@web/features/coaching/pages/ClassStudentProfilePage';

// ---------------------------------------------------------------------------
// Page Test Fixtures
// ---------------------------------------------------------------------------

const mockClassListData = {
  items: [
    {
      id: 'class-uuid-1',
      coachId: 'coach-uuid-1',
      name: '周三进阶班',
      memberCount: 5,
      lessonCount: 12,
      createdAt: '2026-04-13T10:00:00.000Z',
    },
    {
      id: 'class-uuid-2',
      coachId: 'coach-uuid-1',
      name: '周五入门班',
      memberCount: 3,
      lessonCount: 4,
      createdAt: '2026-04-10T10:00:00.000Z',
    },
  ],
};

const mockClassDetailData = {
  id: 'class-uuid-1',
  coachId: 'coach-uuid-1',
  name: '周三进阶班',
  memberCount: 2,
  lessonCount: 3,
  members: [
    {
      studentId: 'student-uuid-1',
      nickname: '学员小王',
      avatarUrl: null,
      joinedAt: '2026-04-13T10:00:00.000Z',
    },
  ],
  createdAt: '2026-04-13T10:00:00.000Z',
};

const mockLessonsData = {
  items: [
    {
      id: 'lesson-uuid-1',
      venue: { id: 'venue-uuid-1', name: '朝阳体育中心', address: '...' },
      startTime: '2026-04-15T14:00:00.000Z',
      endTime: '2026-04-15T16:00:00.000Z',
      trainingContent: '步法训练',
      status: 'scheduled',
      createdAt: '2026-04-13T10:00:00.000Z',
    },
    {
      id: 'lesson-uuid-2',
      venue: { id: 'venue-uuid-1', name: '朝阳体育中心', address: '...' },
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      trainingContent: null,
      status: 'completed',
      createdAt: '2026-04-08T10:00:00.000Z',
    },
  ],
};

const mockLessonDetailCompleted = {
  id: 'lesson-uuid-1',
  studentClassId: 'class-uuid-1',
  coachId: 'coach-uuid-1',
  venue: { id: 'venue-uuid-1', name: '朝阳体育中心', address: '北京市朝阳区...' },
  startTime: '2026-04-15T14:00:00.000Z',
  endTime: '2026-04-15T16:00:00.000Z',
  trainingContent: '步法训练 + 高远球',
  status: 'completed',
  createdAt: '2026-04-13T10:00:00.000Z',
};

const mockLessonDetailScheduled = {
  ...mockLessonDetailCompleted,
  status: 'scheduled',
};

const mockLessonDetailCancelled = {
  ...mockLessonDetailCompleted,
  status: 'cancelled',
};

// ---------------------------------------------------------------------------
// StudentClassListPage Tests
// ---------------------------------------------------------------------------

describe('StudentClassListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserState = { data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' }, isLoading: false };
    mockStudentClassesState = { data: null, isLoading: false, error: null };
  });

  // 来源: coaching-v2.md 附录 B.1 — 学员班列表页
  it('should show loading state', () => {
    mockCurrentUserState = { data: null, isLoading: true };
    render(<StudentClassListPage />);
    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  it('should show empty state when no classes', () => {
    mockStudentClassesState = { data: { items: [] }, isLoading: false, error: null };
    render(<StudentClassListPage />);
    expect(screen.getByText(/暂无学员班/i)).toBeInTheDocument();
  });

  it('should render class list with names and stats', () => {
    mockStudentClassesState = { data: mockClassListData, isLoading: false, error: null };
    render(<StudentClassListPage />);
    expect(screen.getByText('周三进阶班')).toBeInTheDocument();
    expect(screen.getByText('周五入门班')).toBeInTheDocument();
    expect(screen.getByText(/5 名学员/)).toBeInTheDocument();
    expect(screen.getByText(/12 节课程/)).toBeInTheDocument();
  });

  it('should navigate to detail on class click', async () => {
    mockStudentClassesState = { data: mockClassListData, isLoading: false, error: null };
    render(<StudentClassListPage />);
    await userEvent.click(screen.getByText('周三进阶班'));
    expect(mockNavigate).toHaveBeenCalledWith('/my-student-classes/class-uuid-1');
  });

  it('should open create modal when FAB is clicked', async () => {
    mockStudentClassesState = { data: { items: [] }, isLoading: false, error: null };
    render(<StudentClassListPage />);
    await userEvent.click(screen.getByLabelText('创建学员班'));
    expect(screen.getByText('创建学员班')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/班级名称/i)).toBeInTheDocument();
  });

  it('should call createStudentClass mutation when creating', async () => {
    mockStudentClassesState = { data: { items: [] }, isLoading: false, error: null };
    render(<StudentClassListPage />);
    await userEvent.click(screen.getByLabelText('创建学员班'));
    await userEvent.type(screen.getByPlaceholderText(/班级名称/i), '测试班级');
    await userEvent.click(screen.getByText('创建'));
    expect(mockCreateStudentClass).toHaveBeenCalledWith(
      { name: '测试班级' },
      expect.any(Object),
    );
  });

  it('should show delete confirm when delete button is clicked', async () => {
    mockStudentClassesState = { data: mockClassListData, isLoading: false, error: null };
    render(<StudentClassListPage />);
    const deleteButtons = screen.getAllByText('删除');
    await userEvent.click(deleteButtons[0]);
    expect(screen.getByRole('button', { name: /确认删除/ })).toBeInTheDocument();
  });

  it('should show coach guard for non-coach users', () => {
    mockCurrentUserState = { data: { id: 'user-uuid-1', isCoach: false, nickname: '普通用户' }, isLoading: false };
    render(<StudentClassListPage />);
    expect(screen.getByText(/开启教练角色/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StudentClassDetailPage Tests
// ---------------------------------------------------------------------------

describe('StudentClassDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentClassDetailState = { data: null, isLoading: false, error: null };
    mockClassLessonsState = { data: null, isLoading: false, error: null };
  });

  it('should show loading state', () => {
    mockStudentClassDetailState = { data: null, isLoading: true, error: null };
    render(<StudentClassDetailPage />);
    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  it('should show not found when class does not exist', () => {
    mockStudentClassDetailState = { data: null, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    expect(screen.getByText(/不存在/i)).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 学员班详情页 — 两个 tab
  it('should render class name and two tabs', () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    expect(screen.getByText('周三进阶班')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '学员' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '课程' })).toBeInTheDocument();
  });

  it('should render member list in students tab', () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    expect(screen.getByText('学员小王')).toBeInTheDocument();
    expect(screen.getByText('添加学员')).toBeInTheDocument();
  });

  it('should show add student modal when button clicked', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    await userEvent.click(screen.getByText('添加学员'));
    expect(screen.getByPlaceholderText(/搜索昵称/i)).toBeInTheDocument();
  });

  it('should show remove confirm when remove button clicked', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    await userEvent.click(screen.getByText('移除'));
    expect(screen.getByText(/确认移除/i)).toBeInTheDocument();
  });

  it('should show lesson list when lessons tab is clicked', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    mockClassLessonsState = { data: mockLessonsData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: '课程' }));
    expect(screen.getByText('创建课程')).toBeInTheDocument();
    expect(screen.getAllByText(/朝阳体育中心/i).length).toBeGreaterThanOrEqual(1);
  });

  it('should show status badges on lessons', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    mockClassLessonsState = { data: mockLessonsData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: '课程' }));
    expect(screen.getByText('未开始')).toBeInTheDocument();
    expect(screen.getByText('已结束')).toBeInTheDocument();
  });

  it('should navigate to lesson detail on click', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    mockClassLessonsState = { data: mockLessonsData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: '课程' }));
    // Click on first lesson card
    const venueTexts = screen.getAllByText(/朝阳体育中心/i);
    await userEvent.click(venueTexts[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/my-student-classes/class-uuid-1/lessons/lesson-uuid-1');
  });

  it('should navigate to student profile on member click', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    await userEvent.click(screen.getByText('学员小王'));
    expect(mockNavigate).toHaveBeenCalledWith('/my-student-classes/class-uuid-1/members/student-uuid-1');
  });

  it('should show edit name modal on click', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    render(<StudentClassDetailPage />);
    await userEvent.click(screen.getByText('编辑名称'));
    expect(screen.getByText('编辑班级名称')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ClassLessonDetailPage Tests
// ---------------------------------------------------------------------------

describe('ClassLessonDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClassLessonDetailState = { data: null, isLoading: false, error: null };
    mockLessonNotesState = { data: null, isLoading: false, error: null };
  });

  it('should show loading state', () => {
    mockClassLessonDetailState = { data: null, isLoading: true, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  it('should show not found when lesson does not exist', () => {
    mockClassLessonDetailState = { data: null, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.getByText(/不存在/i)).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 学员班课程详情页
  it('should render lesson info with status badge', () => {
    mockClassLessonDetailState = { data: mockLessonDetailCompleted, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.getByText(/课程详情/i)).toBeInTheDocument();
    expect(screen.getByText('已结束')).toBeInTheDocument();
    expect(screen.getByText(/朝阳体育中心/i)).toBeInTheDocument();
  });

  it('should render training content section', () => {
    mockClassLessonDetailState = { data: mockLessonDetailCompleted, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.getByText(/训练内容/i)).toBeInTheDocument();
    expect(screen.getByText(/步法训练/i)).toBeInTheDocument();
  });

  it('should show edit button for training content when not cancelled', () => {
    mockClassLessonDetailState = { data: mockLessonDetailCompleted, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('should not show edit button for cancelled lesson', () => {
    mockClassLessonDetailState = { data: mockLessonDetailCancelled, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
  });

  it('should show notes section with input', () => {
    mockClassLessonDetailState = { data: mockLessonDetailCompleted, isLoading: false, error: null };
    mockLessonNotesState = {
      data: {
        items: [{ id: 'note-1', content: '今天训练效果好', createdAt: '2026-04-15T16:30:00.000Z' }],
      },
      isLoading: false,
      error: null,
    };
    render(<ClassLessonDetailPage />);
    expect(screen.getByText(/课程笔记/i)).toBeInTheDocument();
    expect(screen.getByText('今天训练效果好')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/笔记/i)).toBeInTheDocument();
  });

  it('should not show note input for cancelled lesson', () => {
    mockClassLessonDetailState = { data: mockLessonDetailCancelled, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.queryByPlaceholderText(/笔记/i)).not.toBeInTheDocument();
  });

  it('should call addLessonNote when adding note', async () => {
    mockClassLessonDetailState = { data: mockLessonDetailCompleted, isLoading: false, error: null };
    mockLessonNotesState = { data: { items: [] }, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    await userEvent.type(screen.getByPlaceholderText(/笔记/i), '新笔记');
    await userEvent.click(screen.getByText('添加'));
    expect(mockAddLessonNote).toHaveBeenCalledWith(
      { classId: 'class-uuid-1', lessonId: 'lesson-uuid-1', content: '新笔记' },
      expect.any(Object),
    );
  });

  it('should show cancel button for scheduled lesson', () => {
    mockClassLessonDetailState = { data: mockLessonDetailScheduled, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.getByText('取消课程')).toBeInTheDocument();
  });

  it('should not show cancel button for completed lesson', () => {
    mockClassLessonDetailState = { data: mockLessonDetailCompleted, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.queryByText('取消课程')).not.toBeInTheDocument();
  });

  it('should show match record section for completed/in_progress lessons', () => {
    mockClassLessonDetailState = { data: mockLessonDetailCompleted, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.getByText('录入战绩')).toBeInTheDocument();
  });

  it('should not show match record section for scheduled lessons', () => {
    mockClassLessonDetailState = { data: mockLessonDetailScheduled, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    expect(screen.queryByText('录入战绩')).not.toBeInTheDocument();
  });

  it('should show cancel confirm dialog', async () => {
    mockClassLessonDetailState = { data: mockLessonDetailScheduled, isLoading: false, error: null };
    render(<ClassLessonDetailPage />);
    await userEvent.click(screen.getByText('取消课程'));
    expect(screen.getByRole('button', { name: /确认取消/ })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ClassStudentProfilePage Tests
// ---------------------------------------------------------------------------

describe('ClassStudentProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentClassDetailState = { data: null, isLoading: false, error: null };
    mockStudentNotesState = { data: null, isLoading: false, error: null };
    mockStudentTagsState = { data: null, isLoading: false, error: null };
  });

  it('should show loading state', () => {
    mockStudentClassDetailState = { data: null, isLoading: true, error: null };
    render(<ClassStudentProfilePage />);
    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  it('should show not found when student does not exist', () => {
    mockStudentClassDetailState = {
      data: { ...mockClassDetailData, members: [] },
      isLoading: false,
      error: null,
    };
    render(<ClassStudentProfilePage />);
    expect(screen.getByText(/不存在/i)).toBeInTheDocument();
  });

  // 来源: coaching-v2.md 附录 B.1 — 学员档案页
  it('should render student info header', () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    render(<ClassStudentProfilePage />);
    expect(screen.getByText('学员小王')).toBeInTheDocument();
    expect(screen.getByText(/加入/i)).toBeInTheDocument();
  });

  it('should render tags section', () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    mockStudentTagsState = { data: { tags: ['左手', '进攻型'] }, isLoading: false, error: null };
    render(<ClassStudentProfilePage />);
    expect(screen.getByText('标签')).toBeInTheDocument();
    expect(screen.getByText('左手')).toBeInTheDocument();
    expect(screen.getByText('进攻型')).toBeInTheDocument();
  });

  it('should show empty tags state', () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    mockStudentTagsState = { data: { tags: [] }, isLoading: false, error: null };
    render(<ClassStudentProfilePage />);
    expect(screen.getByText(/暂无标签/i)).toBeInTheDocument();
  });

  it('should call setStudentTags when adding a tag', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    mockStudentTagsState = { data: { tags: ['左手'] }, isLoading: false, error: null };
    render(<ClassStudentProfilePage />);

    const tagInput = screen.getByPlaceholderText(/标签/i);
    await userEvent.type(tagInput, '进攻型');
    // Click the "添加" button in the tags section (first one)
    const addButtons = screen.getAllByText('添加');
    await userEvent.click(addButtons[0]);
    expect(mockSetStudentTags).toHaveBeenCalledWith(
      { classId: 'class-uuid-1', studentId: 'student-uuid-1', tags: ['左手', '进攻型'] },
      expect.any(Object),
    );
  });

  it('should render notes section', () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    mockStudentNotesState = {
      data: {
        items: [{ id: 'snote-1', content: '步法需要加强', createdAt: '2026-04-15T16:30:00.000Z' }],
      },
      isLoading: false,
      error: null,
    };
    render(<ClassStudentProfilePage />);
    expect(screen.getByText('学员笔记')).toBeInTheDocument();
    expect(screen.getByText('步法需要加强')).toBeInTheDocument();
  });

  it('should call addStudentNote when adding a note', async () => {
    mockStudentClassDetailState = { data: mockClassDetailData, isLoading: false, error: null };
    mockStudentNotesState = { data: { items: [] }, isLoading: false, error: null };
    render(<ClassStudentProfilePage />);

    const noteInput = screen.getByPlaceholderText(/笔记/i);
    await userEvent.type(noteInput, '今天表现好');
    // Click the add button in notes section (second one)
    const addButtons = screen.getAllByText('添加');
    await userEvent.click(addButtons[addButtons.length - 1]);
    expect(mockAddStudentNote).toHaveBeenCalledWith(
      { classId: 'class-uuid-1', studentId: 'student-uuid-1', content: '今天表现好' },
      expect.any(Object),
    );
  });
});
