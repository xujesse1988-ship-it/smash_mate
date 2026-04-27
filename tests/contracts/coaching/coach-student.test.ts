/**
 * 契约测试: coaching 模块 — 统一学员管理 (CoachStudent)
 *
 * 覆盖接口（设计文档 docs/redesign/coach-student-unified.md §4.1 / §4.2）:
 *   - GET    /api/coach-students                            (CoachingService.getCoachStudents)
 *   - GET    /api/coach-students/:studentId                 (CoachingService.getCoachStudentDetail)
 *   - POST   /api/coach-students                            (CoachingService.addCoachStudent)
 *   - POST   /api/coach-students/search-by-phone            (CoachingService.searchStudentByPhone)
 *   - PUT    /api/coach-students/:studentId/tags            (CoachingService.setCoachStudentTags)
 *   - POST   /api/coach-students/:studentId/lessons         (CoachingService.scheduleLessonForStudent)
 *   - GET    /api/coach-students/:studentId/lessons         (CoachingService.getPrivateLessonsByCoachStudent)
 *
 * Mock 策略:
 * - CoachingRepository: 全部 mock（隔离数据库依赖）
 * - UserService / VenueService / NotificationService: mock（跨模块依赖）
 *
 * 注意: 路由控制器层的 401 (未登录) 由 authMiddleware 处理，本测试在 service
 * 层覆盖 403 (非教练角色) 的契约。authMiddleware 的 401 行为在路由集成测试中验证。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRepository() {
  return {
    // Coach profile
    findCoachProfile: vi.fn().mockResolvedValue(null),
    createCoachProfile: vi.fn().mockResolvedValue(undefined),
    updateCoachProfile: vi.fn().mockResolvedValue(undefined),
    findCoachList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCoachPrivateLessons: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findGroupClassesByCoach: vi.fn().mockResolvedValue([]),
    getBatchCoachStudentCounts: vi.fn().mockResolvedValue(new Map()),

    // Group class / private lesson stubs
    createGroupClass: vi.fn().mockResolvedValue(undefined),
    findGroupClassById: vi.fn().mockResolvedValue(null),
    updateGroupClass: vi.fn().mockResolvedValue(undefined),
    enrollGroupClass: vi.fn().mockResolvedValue(undefined),
    cancelEnrollment: vi.fn().mockResolvedValue(undefined),
    createPrivateLesson: vi.fn().mockResolvedValue(undefined),
    createPrivateLessonSlots: vi.fn().mockResolvedValue([]),
    findAvailability: vi.fn().mockResolvedValue([]),
    bookPrivateLesson: vi.fn().mockResolvedValue(undefined),
    cancelPrivateLesson: vi.fn().mockResolvedValue(undefined),
    findPrivateLessonById: vi.fn().mockResolvedValue(null),
    updatePrivateLesson: vi.fn().mockResolvedValue(undefined),
    updatePrivateLessonTrainingContent: vi.fn().mockResolvedValue(undefined),
    findPrivateLessonsByStudent: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findUserEnrollments: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getGroupClassParticipantIds: vi.fn().mockResolvedValue([]),
    getPrivateLessonParticipantIds: vi.fn().mockResolvedValue([]),

    // Status transitions
    markSlotsExpired: vi.fn().mockResolvedValue(0),
    markPrivateLessonsInProgress: vi.fn().mockResolvedValue([]),
    markPrivateLessonsCompleted: vi.fn().mockResolvedValue(0),
    deleteExpiredSlots: vi.fn().mockResolvedValue(0),
    updateGroupClassesStarted: vi.fn().mockResolvedValue([]),
    findEnrollmentsByGroupClassIds: vi.fn().mockResolvedValue([]),
    updateGroupClassesCompleted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsStarted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsCompleted: vi.fn().mockResolvedValue(0),
    findScheduledClassLessonsToStart: vi.fn().mockResolvedValue([]),
    findInProgressClassLessonsToEnd: vi.fn().mockResolvedValue([]),
    updateClassLessonsStarted: vi.fn().mockResolvedValue(0),
    updateClassLessonsCompleted: vi.fn().mockResolvedValue(0),

    // Coach Application
    createCoachApplication: vi.fn().mockResolvedValue(undefined),
    findLatestApplicationByUser: vi.fn().mockResolvedValue(null),
    findCoachApplicationById: vi.fn().mockResolvedValue(null),
    findCoachApplications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    updateCoachApplication: vi.fn().mockResolvedValue(undefined),

    // Student class
    createStudentClass: vi.fn().mockResolvedValue(undefined),
    findStudentClassById: vi.fn().mockResolvedValue(null),
    findStudentClassesByCoach: vi.fn().mockResolvedValue([]),
    updateStudentClass: vi.fn().mockResolvedValue(undefined),
    deleteStudentClass: vi.fn().mockResolvedValue(undefined),
    addStudentClassMember: vi.fn().mockResolvedValue(undefined),
    removeStudentClassMember: vi.fn().mockResolvedValue(undefined),
    findStudentClassMember: vi.fn().mockResolvedValue(null),
    findStudentClassMembers: vi.fn().mockResolvedValue([]),
    countStudentClassMembers: vi.fn().mockResolvedValue(0),
    countClassLessons: vi.fn().mockResolvedValue(0),
    createClassLesson: vi.fn().mockResolvedValue(undefined),
    findClassLessonById: vi.fn().mockResolvedValue(null),
    findClassLessonsByClassId: vi.fn().mockResolvedValue([]),
    updateClassLesson: vi.fn().mockResolvedValue(undefined),
    getStudentClassMemberIds: vi.fn().mockResolvedValue([]),

    // CoachStudent / unified library
    createCoachStudent: vi.fn().mockResolvedValue(undefined),
    recordCoachStudents: vi.fn().mockResolvedValue(0),
    findCoachStudentByCoachAndStudent: vi.fn().mockResolvedValue(null),
    findCoachStudentDetail: vi.fn().mockResolvedValue(null),
    findCoachStudents: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCoachStudentTagsList: vi.fn().mockResolvedValue([]),
    findAllCoachCustomTags: vi.fn().mockResolvedValue([]),
    setCoachStudentTags: vi.fn().mockResolvedValue([]),
    findStudentIdsWithTag: vi.fn().mockResolvedValue([]),
    findStudentClassesForStudents: vi.fn().mockResolvedValue(new Map()),
    findStudentIdsWhoTookGroupClass: vi.fn().mockResolvedValue(new Set()),
    findStudentIdsWhoTookPrivateLesson: vi.fn().mockResolvedValue(new Set()),

    // Notes / tags
    createLessonNote: vi.fn().mockResolvedValue(undefined),
    findLessonNotes: vi.fn().mockResolvedValue([]),
  };
}

function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: 'coach-uuid-1',
      nickname: '教练张',
      avatarUrl: null,
      bio: null,
      isCoach: true,
      phone: '13800001234',
    }),
    getUsersByIds: vi.fn().mockResolvedValue([]),
    getUserByPhone: vi.fn().mockResolvedValue(null),
  };
}

function createMockVenueService() {
  return {
    getVenueById: vi.fn().mockResolvedValue({
      id: 'venue-uuid-1',
      name: '朝阳体育中心羽毛球馆',
      address: '北京市朝阳区工体北路',
      latitude: 39.9215,
      longitude: 116.4435,
    }),
  };
}

function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue(undefined),
  };
}

const COACH_ID = 'coach-uuid-1';
const STUDENT_ID = 'student-uuid-1';

function makeCoachStudentRow(
  overrides: Partial<{
    studentId: string;
    source: string;
    firstMetAt: Date;
    student: { id: string; nickname: string; avatarUrl: string | null; phone: string | null };
  }> = {},
) {
  return {
    studentId: STUDENT_ID,
    source: 'manual',
    firstMetAt: new Date('2026-04-01T10:00:00.000Z'),
    student: {
      id: STUDENT_ID,
      nickname: '学员小明',
      avatarUrl: null,
      phone: '13800002222',
    },
    ...overrides,
  };
}

function buildService() {
  const repo = createMockRepository();
  const userService = createMockUserService();
  const venueService = createMockVenueService();
  const notificationService = createMockNotificationService();
  const service = new CoachingService(
    repo as unknown as CoachingRepository,
    userService,
    venueService,
    notificationService,
  );
  return { service, repo, userService, venueService, notificationService };
}

// ===========================================================================
// GET /api/coach-students — getCoachStudents
// ===========================================================================

describe('GET /api/coach-students — CoachingService.getCoachStudents', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  it('returns empty list when coach has no students', async () => {
    ctx.repo.findCoachStudents.mockResolvedValue({ items: [], total: 0 });

    const result = await ctx.service.getCoachStudents(COACH_ID, {});

    expect(result).toMatchObject({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(ctx.repo.findCoachStudents).toHaveBeenCalledWith(COACH_ID, {
      search: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it('returns items with derived tags merged (group-class + private-lesson + class)', async () => {
    ctx.repo.findCoachStudents.mockResolvedValue({
      items: [makeCoachStudentRow()],
      total: 1,
    });
    ctx.repo.findStudentClassesForStudents.mockResolvedValue(
      new Map([[STUDENT_ID, [{ id: 'class-1', name: '周三进阶班' }]]]),
    );
    ctx.repo.findStudentIdsWhoTookGroupClass.mockResolvedValue(new Set([STUDENT_ID]));
    ctx.repo.findStudentIdsWhoTookPrivateLesson.mockResolvedValue(new Set([STUDENT_ID]));
    ctx.repo.findCoachStudentTagsList.mockResolvedValue([{ tag: '固定私教' }]);

    const result = await ctx.service.getCoachStudents(COACH_ID, {});

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.studentId).toBe(STUDENT_ID);
    expect(item.tags).toEqual(
      expect.arrayContaining(['团课学员', '私教学员', '固定私教']),
    );
    // 学员班归属现以结构化字段返回，不再混入 tags
    expect(item.studentClasses).toEqual([{ id: 'class-1', name: '周三进阶班' }]);
    expect(item.phoneLast4).toBe('2222');
  });

  it('honors page / pageSize pagination params', async () => {
    ctx.repo.findCoachStudents.mockResolvedValue({ items: [], total: 0 });

    await ctx.service.getCoachStudents(COACH_ID, { page: 3, pageSize: 5 });

    expect(ctx.repo.findCoachStudents).toHaveBeenCalledWith(COACH_ID, {
      search: undefined,
      page: 3,
      pageSize: 5,
    });
  });

  it('passes search keyword to repository', async () => {
    ctx.repo.findCoachStudents.mockResolvedValue({ items: [], total: 0 });

    await ctx.service.getCoachStudents(COACH_ID, { search: '小明' });

    expect(ctx.repo.findCoachStudents).toHaveBeenCalledWith(COACH_ID, {
      search: '小明',
      page: 1,
      pageSize: 20,
    });
  });

  it('filters returned items by derived tag (page-local filter)', async () => {
    const a = makeCoachStudentRow({ studentId: 'student-A' });
    const b = makeCoachStudentRow({
      studentId: 'student-B',
      student: { id: 'student-B', nickname: 'B', avatarUrl: null, phone: '13800003333' },
    });
    ctx.repo.findCoachStudents.mockResolvedValue({ items: [a, b], total: 2 });
    // Only student A took a private lesson with this coach
    ctx.repo.findStudentIdsWhoTookPrivateLesson.mockResolvedValue(new Set(['student-A']));

    const result = await ctx.service.getCoachStudents(COACH_ID, { tag: '私教学员' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].studentId).toBe('student-A');
    // total still reflects un-filtered count (page-local filter)
    expect(result.total).toBe(2);
  });

  it('rejects when caller is not a coach (403 COACHING_COACH_ROLE_REQUIRED)', async () => {
    ctx.userService.getUserById.mockResolvedValue({
      id: COACH_ID,
      nickname: '普通用户',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await expect(ctx.service.getCoachStudents(COACH_ID, {})).rejects.toMatchObject({
      code: 'COACHING_COACH_ROLE_REQUIRED',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/coach-students/:studentId — getCoachStudentDetail
// ===========================================================================

describe('GET /api/coach-students/:studentId — CoachingService.getCoachStudentDetail', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  it('returns detail with derived + custom tags merged', async () => {
    ctx.repo.findCoachStudentDetail.mockResolvedValue({
      studentId: STUDENT_ID,
      coachId: COACH_ID,
      source: 'group-class',
      firstMetAt: new Date('2026-04-02T10:00:00.000Z'),
    });
    ctx.userService.getUserById.mockImplementation((id: string) => {
      if (id === STUDENT_ID) {
        return Promise.resolve({
          id: STUDENT_ID,
          nickname: '学员小明',
          avatarUrl: null,
          isCoach: false,
          phone: '13800002222',
        });
      }
      return Promise.resolve({
        id: COACH_ID,
        nickname: '教练张',
        avatarUrl: null,
        isCoach: true,
      });
    });
    ctx.repo.findStudentClassesForStudents.mockResolvedValue(
      new Map([[STUDENT_ID, [{ id: 'cls-1', name: '周三进阶班' }]]]),
    );
    ctx.repo.findStudentIdsWhoTookGroupClass.mockResolvedValue(new Set([STUDENT_ID]));
    ctx.repo.findStudentIdsWhoTookPrivateLesson.mockResolvedValue(new Set());
    ctx.repo.findCoachStudentTagsList.mockResolvedValue([{ tag: '固定私教' }]);

    const detail = await ctx.service.getCoachStudentDetail(COACH_ID, STUDENT_ID);

    expect(detail.studentId).toBe(STUDENT_ID);
    expect(detail.source).toBe('group-class');
    expect(detail.tags).toEqual(
      expect.arrayContaining(['团课学员', '固定私教']),
    );
    // 学员班归属现以结构化字段返回，不再混入 tags
    expect(detail.studentClasses).toEqual([{ id: 'cls-1', name: '周三进阶班' }]);
    expect(detail.phoneLast4).toBe('2222');
  });

  it('throws 404 COACHING_COACH_STUDENT_NOT_FOUND when relation missing', async () => {
    ctx.repo.findCoachStudentDetail.mockResolvedValue(null);

    await expect(ctx.service.getCoachStudentDetail(COACH_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'COACHING_COACH_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// POST /api/coach-students — addCoachStudent
// ===========================================================================

describe('POST /api/coach-students — CoachingService.addCoachStudent', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  it('manually adds an existing student with source=manual', async () => {
    ctx.userService.getUserById.mockImplementation((id: string) => {
      if (id === COACH_ID) {
        return Promise.resolve({
          id: COACH_ID,
          nickname: '教练张',
          avatarUrl: null,
          isCoach: true,
        });
      }
      return Promise.resolve({
        id: STUDENT_ID,
        nickname: '学员小明',
        avatarUrl: null,
        isCoach: false,
      });
    });
    ctx.repo.createCoachStudent.mockResolvedValue({
      id: 'cs-uuid-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
      firstMetAt: new Date('2026-04-15T10:00:00.000Z'),
    });

    const result = await ctx.service.addCoachStudent(COACH_ID, { studentId: STUDENT_ID });

    expect(result).toMatchObject({ studentId: STUDENT_ID, source: 'manual' });
    expect(ctx.repo.createCoachStudent).toHaveBeenCalledWith({
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
    });
  });

  it('returns 404 USER_NOT_FOUND when student does not exist', async () => {
    ctx.userService.getUserById.mockImplementation((id: string) => {
      if (id === COACH_ID) {
        return Promise.resolve({
          id: COACH_ID,
          nickname: '教练张',
          avatarUrl: null,
          isCoach: true,
        });
      }
      return Promise.resolve(null);
    });

    await expect(
      ctx.service.addCoachStudent(COACH_ID, { studentId: 'missing' }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
  });

  it('is idempotent when student already exists in library (does not throw)', async () => {
    ctx.userService.getUserById.mockImplementation((id: string) => {
      if (id === COACH_ID) {
        return Promise.resolve({
          id: COACH_ID,
          nickname: '教练张',
          avatarUrl: null,
          isCoach: true,
        });
      }
      return Promise.resolve({
        id: STUDENT_ID,
        nickname: '学员小明',
        avatarUrl: null,
        isCoach: false,
      });
    });
    // Repository's createCoachStudent is contractually idempotent: returns the
    // existing CoachStudent if the (coach, student) pair already exists.
    ctx.repo.createCoachStudent.mockResolvedValue({
      id: 'cs-uuid-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'group-class', // existing source; manual call must not overwrite
      firstMetAt: new Date('2026-04-01T10:00:00.000Z'),
    });

    const result = await ctx.service.addCoachStudent(COACH_ID, { studentId: STUDENT_ID });

    expect(result.source).toBe('group-class');
  });

  it('rejects when caller is not a coach (403)', async () => {
    ctx.userService.getUserById.mockResolvedValue({
      id: COACH_ID,
      nickname: '普通用户',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await expect(
      ctx.service.addCoachStudent(COACH_ID, { studentId: STUDENT_ID }),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_ROLE_REQUIRED', statusCode: 403 });
  });
});

// ===========================================================================
// POST /api/coach-students/search-by-phone — searchStudentByPhone
// ===========================================================================

describe('POST /api/coach-students/search-by-phone — CoachingService.searchStudentByPhone', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  it('returns user info when phone is registered', async () => {
    ctx.userService.getUserByPhone.mockResolvedValue({
      id: STUDENT_ID,
      nickname: '学员小明',
      avatarUrl: null,
      phone: '13800002222',
    });

    const result = await ctx.service.searchStudentByPhone(COACH_ID, {
      phone: '13800002222',
    });

    expect(result).toEqual({
      userId: STUDENT_ID,
      nickname: '学员小明',
      phoneLast4: '2222',
    });
  });

  it('returns 404 COACH_STUDENT_NOT_REGISTERED when phone not in users table', async () => {
    ctx.userService.getUserByPhone.mockResolvedValue(null);

    await expect(
      ctx.service.searchStudentByPhone(COACH_ID, { phone: '13900000000' }),
    ).rejects.toMatchObject({ code: 'COACH_STUDENT_NOT_REGISTERED', statusCode: 404 });
  });

  it('rejects when caller is not a coach (403)', async () => {
    ctx.userService.getUserById.mockResolvedValue({
      id: COACH_ID,
      nickname: '普通用户',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await expect(
      ctx.service.searchStudentByPhone(COACH_ID, { phone: '13800001111' }),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_ROLE_REQUIRED', statusCode: 403 });
  });
});

// ===========================================================================
// PUT /api/coach-students/:studentId/tags — setCoachStudentTags
// ===========================================================================

describe('PUT /api/coach-students/:studentId/tags — CoachingService.setCoachStudentTags', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  it('overwrites custom tags for the student', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue({
      id: 'cs-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
    });
    ctx.repo.setCoachStudentTags.mockResolvedValue(['固定私教', 'VIP']);

    const result = await ctx.service.setCoachStudentTags(COACH_ID, STUDENT_ID, {
      tags: ['固定私教', 'VIP'],
    });

    expect(result).toEqual({ tags: ['固定私教', 'VIP'] });
    expect(ctx.repo.setCoachStudentTags).toHaveBeenCalledWith(COACH_ID, STUDENT_ID, [
      '固定私教',
      'VIP',
    ]);
  });

  it('throws 404 when student is not in the coach library', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue(null);

    await expect(
      ctx.service.setCoachStudentTags(COACH_ID, STUDENT_ID, { tags: ['VIP'] }),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_STUDENT_NOT_FOUND', statusCode: 404 });
  });

  it('rejects more than 10 tags', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue({
      id: 'cs-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
    });

    await expect(
      ctx.service.setCoachStudentTags(COACH_ID, STUDENT_ID, {
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_TAGS', statusCode: 400 });
  });

  it('rejects empty / over-length tags', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue({
      id: 'cs-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
    });

    await expect(
      ctx.service.setCoachStudentTags(COACH_ID, STUDENT_ID, { tags: ['a'.repeat(21)] }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_TAGS', statusCode: 400 });
  });
});

// ===========================================================================
// POST /api/coach-students/:studentId/lessons — scheduleLessonForStudent
// ===========================================================================

describe('POST /api/coach-students/:studentId/lessons — CoachingService.scheduleLessonForStudent', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  function futureIso(hours: number): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }

  it('schedules a lesson with source=scheduled when student is in library', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue({
      id: 'cs-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
    });
    ctx.repo.createPrivateLesson.mockResolvedValue({
      id: 'pl-uuid-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'scheduled',
      status: 'scheduled',
      startTime: new Date(futureIso(48)),
      endTime: new Date(futureIso(50)),
    });

    const result = await ctx.service.scheduleLessonForStudent(COACH_ID, STUDENT_ID, {
      startTime: futureIso(48),
      endTime: futureIso(50),
    });

    expect(result.id).toBe('pl-uuid-1');
    expect(ctx.repo.createPrivateLesson).toHaveBeenCalledWith(
      expect.objectContaining({
        coachId: COACH_ID,
        studentId: STUDENT_ID,
        source: 'scheduled',
      }),
    );
  });

  it('returns 404 COACHING_COACH_STUDENT_NOT_FOUND if student not in library (403 per design)', async () => {
    // Service surfaces this as 404 (relation lookup miss); the controller treats
    // the absence as 'forbidden to schedule for an unknown student' per design §4.2.
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue(null);

    await expect(
      ctx.service.scheduleLessonForStudent(COACH_ID, STUDENT_ID, {
        startTime: futureIso(48),
        endTime: futureIso(50),
      }),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_STUDENT_NOT_FOUND', statusCode: 404 });
  });

  it('rejects past startTime', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue({
      id: 'cs-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
    });

    await expect(
      ctx.service.scheduleLessonForStudent(COACH_ID, STUDENT_ID, {
        startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        endTime: futureIso(2),
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_TIME', statusCode: 400 });
  });

  it('rejects when caller is not a coach (403)', async () => {
    ctx.userService.getUserById.mockResolvedValue({
      id: COACH_ID,
      nickname: '普通用户',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await expect(
      ctx.service.scheduleLessonForStudent(COACH_ID, STUDENT_ID, {
        startTime: futureIso(48),
        endTime: futureIso(50),
      }),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_ROLE_REQUIRED', statusCode: 403 });
  });
});

// ===========================================================================
// GET /api/coach-students/:studentId/lessons — getPrivateLessonsByCoachStudent
// ===========================================================================

describe('GET /api/coach-students/:studentId/lessons — CoachingService.getPrivateLessonsByCoachStudent', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  it('returns lessons for the student', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue({
      id: 'cs-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
    });
    ctx.repo.findPrivateLessonsByStudent.mockResolvedValue({
      items: [
        {
          id: 'pl-1',
          coachId: COACH_ID,
          studentId: STUDENT_ID,
          status: 'completed',
          startTime: new Date('2026-04-01T10:00:00.000Z'),
          endTime: new Date('2026-04-01T12:00:00.000Z'),
        },
      ],
      total: 1,
    });

    const result = await ctx.service.getPrivateLessonsByCoachStudent(COACH_ID, STUDENT_ID, {
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('passes status filter through to repository', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue({
      id: 'cs-1',
      coachId: COACH_ID,
      studentId: STUDENT_ID,
      source: 'manual',
    });
    ctx.repo.findPrivateLessonsByStudent.mockResolvedValue({ items: [], total: 0 });

    await ctx.service.getPrivateLessonsByCoachStudent(COACH_ID, STUDENT_ID, {
      status: 'scheduled',
      page: 2,
      pageSize: 5,
    });

    expect(ctx.repo.findPrivateLessonsByStudent).toHaveBeenCalledWith(COACH_ID, STUDENT_ID, {
      status: 'scheduled',
      page: 2,
      pageSize: 5,
    });
  });

  it('throws 404 if student not in library', async () => {
    ctx.repo.findCoachStudentByCoachAndStudent.mockResolvedValue(null);

    await expect(
      ctx.service.getPrivateLessonsByCoachStudent(COACH_ID, STUDENT_ID, {}),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_STUDENT_NOT_FOUND', statusCode: 404 });
  });
});
