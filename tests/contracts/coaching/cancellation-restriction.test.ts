/**
 * 契约测试: coaching 模块 — "课程开始后禁止取消" 统一约束
 *
 * 设计依据: docs/redesign/coach-student-unified.md §6
 *   "function assertCancellable(status) — 当 status === 'in_progress' 或
 *    status === 'completed' 时，所有取消/退课接口必须返回 409。"
 *
 * 覆盖的 service 入口:
 *   - cancelEnrollment (团课学员退课)
 *   - cancelGroupClass (团课教练取消)
 *   - cancelPrivateLesson (私教课取消，覆盖学员预约 + 教练直接排课)
 *   - cancelClassLesson (学员班排课教练取消)
 *
 * Mock 策略: CoachingRepository / UserService / VenueService / NotificationService
 * 全部 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';

const COACH_ID = 'coach-uuid-1';
const STUDENT_ID = 'student-uuid-1';
const CLASS_ID = 'class-uuid-1';
const STUDENT_CLASS_ID = 'student-class-uuid-1';
const LESSON_ID = 'lesson-uuid-1';

function createMockRepository() {
  return {
    findCoachProfile: vi.fn().mockResolvedValue(null),
    createCoachProfile: vi.fn().mockResolvedValue(undefined),
    updateCoachProfile: vi.fn().mockResolvedValue(undefined),
    findCoachList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCoachPrivateLessons: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findGroupClassesByCoach: vi.fn().mockResolvedValue([]),
    getBatchCoachStudentCounts: vi.fn().mockResolvedValue(new Map()),
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
    createCoachApplication: vi.fn().mockResolvedValue(undefined),
    findLatestApplicationByUser: vi.fn().mockResolvedValue(null),
    findCoachApplicationById: vi.fn().mockResolvedValue(null),
    findCoachApplications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    updateCoachApplication: vi.fn().mockResolvedValue(undefined),
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
    updateClassLessonStatus: vi.fn().mockResolvedValue(undefined),
    cancelClassLesson: vi.fn().mockResolvedValue(undefined),
    getStudentClassMemberIds: vi.fn().mockResolvedValue([]),
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
    createLessonNote: vi.fn().mockResolvedValue(undefined),
    findLessonNotes: vi.fn().mockResolvedValue([]),
  };
}

function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: COACH_ID,
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
      name: 'venue',
      address: 'addr',
      latitude: 39.9,
      longitude: 116.4,
    }),
  };
}

function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue(undefined),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGroupClass(status: string) {
  return {
    id: CLASS_ID,
    coachId: COACH_ID,
    venueId: 'venue-uuid-1',
    title: 'gc',
    startTime: new Date(Date.now() - 60 * 1000),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    maxParticipants: 10,
    feeDescription: null,
    status,
    currentParticipants: 1,
    enrollments: [
      { id: 'enroll-1', groupClassId: CLASS_ID, userId: STUDENT_ID, enrolledAt: new Date() },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makePrivateLesson(status: string) {
  return {
    id: LESSON_ID,
    coachId: COACH_ID,
    studentId: STUDENT_ID,
    venueId: null,
    venueIds: [],
    startTime: new Date(Date.now() - 60 * 1000),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    feeDescription: null,
    trainingContent: null,
    source: 'booked',
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeStudentClass() {
  return {
    id: STUDENT_CLASS_ID,
    coachId: COACH_ID,
    name: 'cls',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeClassLesson(status: string) {
  return {
    id: LESSON_ID,
    studentClassId: STUDENT_CLASS_ID,
    coachId: COACH_ID,
    venueId: null,
    startTime: new Date(Date.now() - 60 * 1000),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    trainingContent: null,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ===========================================================================
// 团课 — 学员退课 (cancelEnrollment)
// ===========================================================================

describe('团课学员退课 — 开始后/已结束禁止', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('status=in_progress → 409 COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT', async () => {
    ctx.repo.findGroupClassById.mockResolvedValue(makeGroupClass('in_progress'));

    await expect(ctx.service.cancelEnrollment(CLASS_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
      statusCode: 409,
    });
  });

  it('status=completed → 同样禁止退课', async () => {
    ctx.repo.findGroupClassById.mockResolvedValue(makeGroupClass('completed'));

    await expect(ctx.service.cancelEnrollment(CLASS_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// 团课 — 教练取消 (cancelGroupClass)
// ===========================================================================

describe('团课教练取消 — 开始后/已结束禁止', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('status=in_progress → 409 COACHING_CLASS_NOT_CANCELLABLE', async () => {
    ctx.repo.findGroupClassById.mockResolvedValue(makeGroupClass('in_progress'));

    await expect(ctx.service.cancelGroupClass(CLASS_ID, COACH_ID)).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  it('status=completed → 同样禁止', async () => {
    ctx.repo.findGroupClassById.mockResolvedValue(makeGroupClass('completed'));

    await expect(ctx.service.cancelGroupClass(CLASS_ID, COACH_ID)).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// 私教课 — cancelPrivateLesson (统一覆盖学员预约 + 教练直接排课)
// ===========================================================================

describe('私教课取消 — 开始后/已结束禁止', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('status=in_progress (booked source) 学员尝试取消 → 409 COACHING_LESSON_NOT_CANCELLABLE', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(makePrivateLesson('in_progress'));

    await expect(ctx.service.cancelPrivateLesson(LESSON_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  it('status=in_progress 教练尝试取消 → 同样 409', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(makePrivateLesson('in_progress'));

    await expect(ctx.service.cancelPrivateLesson(LESSON_ID, COACH_ID)).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  it('status=completed → 同样禁止', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(makePrivateLesson('completed'));

    await expect(ctx.service.cancelPrivateLesson(LESSON_ID, COACH_ID)).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  it('status=in_progress (scheduled source — 教练直接排课) → 同样禁止', async () => {
    const lesson = makePrivateLesson('in_progress');
    lesson.source = 'scheduled';
    ctx.repo.findPrivateLessonById.mockResolvedValue(lesson);

    await expect(ctx.service.cancelPrivateLesson(LESSON_ID, COACH_ID)).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// 学员班排课 — cancelClassLesson (教练取消)
// ===========================================================================

describe('学员班排课教练取消 — 开始后/已结束禁止', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('status=in_progress → 409 COACHING_LESSON_NOT_CANCELLABLE', async () => {
    ctx.repo.findStudentClassById.mockResolvedValue(makeStudentClass());
    ctx.repo.findClassLessonById.mockResolvedValue(makeClassLesson('in_progress'));

    await expect(
      ctx.service.cancelClassLesson(COACH_ID, STUDENT_CLASS_ID, LESSON_ID),
    ).rejects.toMatchObject({ code: 'COACHING_LESSON_NOT_CANCELLABLE', statusCode: 409 });
  });

  it('status=completed → 同样禁止', async () => {
    ctx.repo.findStudentClassById.mockResolvedValue(makeStudentClass());
    ctx.repo.findClassLessonById.mockResolvedValue(makeClassLesson('completed'));

    await expect(
      ctx.service.cancelClassLesson(COACH_ID, STUDENT_CLASS_ID, LESSON_ID),
    ).rejects.toMatchObject({ code: 'COACHING_LESSON_NOT_CANCELLABLE', statusCode: 409 });
  });
});
