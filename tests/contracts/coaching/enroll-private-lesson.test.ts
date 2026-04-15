/**
 * 契约测试: coaching 模块 — 团课报名与私教预约接口
 * 覆盖接口:
 *   - POST /api/group-classes/:id/enroll (CoachingService.enrollGroupClass)
 *   - POST /api/group-classes/:id/cancel-enrollment (CoachingService.cancelEnrollment)
 *   - POST /api/private-lessons/availability (CoachingService.setAvailability)
 *   - GET /api/coaches/:id/availability (CoachingService.getCoachAvailability)
 *   - POST /api/private-lessons/book (CoachingService.bookPrivateLesson)
 *   - POST /api/private-lessons/:id/cancel (CoachingService.cancelPrivateLesson)
 *   - GET /api/users/:id/enrollments (CoachingService.getUserEnrollments)
 *   - GET /api/coaches/:id/private-lessons (CoachingService.getCoachPrivateLessons)
 *   - 定时任务: 课程状态自动流转 (私教课部分)
 *   - CoachingService.getPrivateLessonById (跨模块 Service 调用)
 *   - CoachingService.getParticipantIds (跨模块 Service 调用)
 *
 * 来源文档: docs/module-design/coaching.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - CoachingRepository: 全部 mock（隔离数据库依赖）
 * - UserService: mock getUserById / getUsersByIds（跨模块依赖）
 * - VenueService: mock getVenueById（跨模块依赖）
 * - NotificationService: mock create / createBatch（跨模块依赖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';
import type {
  SetAvailabilityInput,
  BookPrivateLessonInput,
  EnrollmentListQuery,
} from '@server/modules/coaching/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock CoachingRepository with all methods stubbed.
 */
function createMockRepository(): {
  [K in keyof CoachingRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findCoachProfile: vi.fn().mockResolvedValue(null),
    createCoachProfile: vi.fn().mockResolvedValue(undefined),
    updateCoachProfile: vi.fn().mockResolvedValue(undefined),
    findCoachList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    createGroupClass: vi.fn().mockResolvedValue(undefined),
    findGroupClassById: vi.fn().mockResolvedValue(null),
    updateGroupClass: vi.fn().mockResolvedValue(undefined),
    enrollGroupClass: vi.fn().mockResolvedValue(undefined),
    cancelEnrollment: vi.fn().mockResolvedValue(undefined),
    createPrivateLessonSlot: vi.fn().mockResolvedValue(undefined),
    findAvailability: vi.fn().mockResolvedValue([]),
    bookPrivateLesson: vi.fn().mockResolvedValue(createPrivateLessonRecord()),
    cancelPrivateLesson: vi.fn().mockResolvedValue(undefined),
    findPrivateLessonById: vi.fn().mockResolvedValue(null),
    findUserEnrollments: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCoachPrivateLessons: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getGroupClassParticipantIds: vi.fn().mockResolvedValue([]),
    getPrivateLessonParticipantIds: vi.fn().mockResolvedValue([]),
    updateGroupClassesStarted: vi.fn().mockResolvedValue(0),
    updateGroupClassesCompleted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsStarted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsCompleted: vi.fn().mockResolvedValue(0),
  };
}

/**
 * Build a mock UserService with cross-module methods.
 */
function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: null,
      isCoach: true,
    }),
    getUsersByIds: vi.fn().mockResolvedValue([
      {
        id: 'user-uuid-coach',
        nickname: '教练张',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: null,
        isCoach: true,
      },
    ]),
  };
}

/**
 * Build a mock VenueService with cross-module methods.
 */
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

/**
 * Build a mock NotificationService with cross-module methods.
 */
function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a mock logger for testing scheduled tasks.
 */
function createMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

/** Standard GroupClass record */
function createGroupClassRecord(
  overrides?: Partial<{
    id: string;
    coachId: string;
    venueId: string | null;
    title: string;
    startTime: Date;
    endTime: Date;
    maxParticipants: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    currentParticipants: number;
    enrollments: Array<{
      id: string;
      groupClassId: string;
      userId: string;
      enrolledAt: Date;
    }>;
  }>,
) {
  return {
    id: 'group-class-uuid-1',
    coachId: 'user-uuid-coach',
    venueId: 'venue-uuid-1',
    title: '初级单打提升班',
    startTime: new Date('2026-04-10T14:00:00.000Z'),
    endTime: new Date('2026-04-10T16:00:00.000Z'),
    maxParticipants: 10,
    status: 'open',
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    currentParticipants: 3,
    enrollments: [],
    ...overrides,
  };
}

/** Standard PrivateLessonSlot record */
function createSlotRecord(
  overrides?: Partial<{
    id: string;
    coachId: string;
    startTime: Date;
    endTime: Date;
    venueIds: string[];
    feeDescription: string | null;
    isBooked: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: 'slot-uuid-1',
    coachId: 'user-uuid-coach',
    startTime: new Date('2026-04-11T10:00:00.000Z'),
    endTime: new Date('2026-04-11T12:00:00.000Z'),
    venueIds: ['venue-uuid-1'],
    feeDescription: '300元/小时',
    isBooked: false,
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    ...overrides,
  };
}

/** Standard PrivateLesson record */
function createPrivateLessonRecord(
  overrides?: Partial<{
    id: string;
    slotId: string;
    coachId: string;
    studentId: string;
    venueId: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: 'private-lesson-uuid-1',
    slotId: 'slot-uuid-1',
    coachId: 'user-uuid-coach',
    studentId: 'user-uuid-student',
    venueId: 'venue-uuid-1',
    startTime: new Date('2026-04-11T10:00:00.000Z'),
    endTime: new Date('2026-04-11T12:00:00.000Z'),
    status: 'scheduled',
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    ...overrides,
  };
}

/** Future time helpers */
function futureDate(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

// ===========================================================================
// POST /api/group-classes/:id/enroll — CoachingService.enrollGroupClass
// ===========================================================================

describe.skip('POST /api/group-classes/:id/enroll — CoachingService.enrollGroupClass', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 团课状态为 open 时可报名（§4 报名团课 - 业务规则）
  it('should enroll student in an open group class', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', currentParticipants: 3 }),
    );
    repo.enrollGroupClass.mockResolvedValue({
      groupClassId: 'group-class-uuid-1',
      userId: 'user-uuid-student',
      currentParticipants: 4,
      status: 'open',
      enrolledAt: new Date(),
    });

    const result = await service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
    expect(result.groupClassId).toBe('group-class-uuid-1');
    expect(result.userId).toBe('user-uuid-student');
    expect(result).toHaveProperty('currentParticipants');
    expect(result).toHaveProperty('enrolledAt');
  });

  // 业务规则: 报名后 currentParticipants == maxParticipants → 自动 full（§4 报名团课 - 业务规则 / §6.4 满员状态联动）
  it('should auto-set status to full when enrollment fills the class', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'open',
        currentParticipants: 9,
        maxParticipants: 10,
      }),
    );
    repo.enrollGroupClass.mockResolvedValue({
      groupClassId: 'group-class-uuid-1',
      userId: 'user-uuid-student',
      currentParticipants: 10,
      status: 'full',
      enrolledAt: new Date(),
    });

    const result = await service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
    expect(result.status).toBe('full');
    expect(result.currentParticipants).toBe(10);
  });

  // 业务规则: 报名成功后通知教练（§4 报名团课 - 业务规则 / §6.10 通知文案）
  it('should notify the coach after successful enrollment with correct notification fields', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', currentParticipants: 3 }),
    );
    repo.enrollGroupClass.mockResolvedValue({
      groupClassId: 'group-class-uuid-1',
      userId: 'user-uuid-student',
      currentParticipants: 4,
      status: 'open',
      enrolledAt: new Date(),
    });
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-student',
      nickname: '学员小明',
      avatarUrl: null,
      isCoach: false,
    });

    await service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student');

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-coach', // 通知接收人是教练
        type: 'GROUP_CLASS_ENROLLED',
        title: '新学员报名',
        targetType: 'group-class',
        targetId: 'group-class-uuid-1',
      }),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 报名团课 - 业务规则）
  it('should not fail when notification creation fails during enrollment', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', currentParticipants: 3 }),
    );
    repo.enrollGroupClass.mockResolvedValue({
      groupClassId: 'group-class-uuid-1',
      userId: 'user-uuid-student',
      currentParticipants: 4,
      status: 'open',
      enrolledAt: new Date(),
    });
    notificationService.create.mockRejectedValue(new Error('Notification error'));

    const result = await service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_GROUP_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_GROUP_CLASS_NOT_FOUND — 团课不存在（§4 报名团课 - 错误码）
  it('should throw COACHING_GROUP_CLASS_NOT_FOUND when group class does not exist', async () => {
    repo.findGroupClassById.mockResolvedValue(null);

    await expect(
      service.enrollGroupClass('nonexistent-uuid', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CANNOT_ENROLL_OWN_CLASS
  // -----------------------------------------------------------------------

  // 错误码: COACHING_CANNOT_ENROLL_OWN_CLASS — 教练报名自己的团课（§4 报名团课 - 错误码）
  it('should throw COACHING_CANNOT_ENROLL_OWN_CLASS when coach enrolls in own class', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', coachId: 'user-uuid-coach' }),
    );

    await expect(
      service.enrollGroupClass('group-class-uuid-1', 'user-uuid-coach'),
    ).rejects.toMatchObject({
      code: 'COACHING_CANNOT_ENROLL_OWN_CLASS',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_FULL
  // -----------------------------------------------------------------------

  // 错误码: COACHING_CLASS_FULL — 团课已满员（§4 报名团课 - 错误码）
  it('should throw COACHING_CLASS_FULL when class status is full', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'full' }),
    );

    await expect(
      service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_FULL',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_ALREADY_ENROLLED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_ALREADY_ENROLLED — 学员已报名该团课（§4 报名团课 - 错误码）
  it('should throw COACHING_ALREADY_ENROLLED when student is already enrolled', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'open',
        enrollments: [
          {
            id: 'e-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'user-uuid-student',
            enrolledAt: new Date(),
          },
        ],
      }),
    );

    await expect(
      service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_ALREADY_ENROLLED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_NOT_ENROLLABLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_CLASS_NOT_ENROLLABLE — in_progress 状态不允许报名（§4 报名团课 - 错误码）
  it('should throw COACHING_CLASS_NOT_ENROLLABLE when status is in_progress', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'in_progress' }),
    );

    await expect(
      service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_ENROLLABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_CLASS_NOT_ENROLLABLE — completed 状态不允许报名（§4 报名团课 - 错误码）
  it('should throw COACHING_CLASS_NOT_ENROLLABLE when status is completed', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'completed' }),
    );

    await expect(
      service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_ENROLLABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_CLASS_NOT_ENROLLABLE — cancelled 状态不允许报名（§4 报名团课 - 错误码）
  it('should throw COACHING_CLASS_NOT_ENROLLABLE when status is cancelled', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );

    await expect(
      service.enrollGroupClass('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_ENROLLABLE',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// POST /api/group-classes/:id/cancel-enrollment — CoachingService.cancelEnrollment
// ===========================================================================

describe.skip('POST /api/group-classes/:id/cancel-enrollment — CoachingService.cancelEnrollment', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 团课状态为 open 时可取消报名（§4 取消团课报名 - 业务规则）
  it('should cancel enrollment from an open group class', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'open',
        currentParticipants: 5,
        enrollments: [
          {
            id: 'e-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'user-uuid-student',
            enrolledAt: new Date(),
          },
        ],
      }),
    );
    repo.cancelEnrollment.mockResolvedValue({
      groupClassId: 'group-class-uuid-1',
      userId: 'user-uuid-student',
      currentParticipants: 4,
      status: 'open',
    });

    const result = await service.cancelEnrollment('group-class-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
    expect(result.groupClassId).toBe('group-class-uuid-1');
    expect(result.userId).toBe('user-uuid-student');
    expect(result).toHaveProperty('currentParticipants');
  });

  // 业务规则: 取消后若当前 status 为 full 且人数 < maxParticipants → 恢复为 open（§4 取消团课报名 - 业务规则 / §6.5）
  it('should restore status to open when cancel-enrollment from a full class', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'full',
        currentParticipants: 10,
        maxParticipants: 10,
        enrollments: [
          {
            id: 'e-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'user-uuid-student',
            enrolledAt: new Date(),
          },
        ],
      }),
    );
    repo.cancelEnrollment.mockResolvedValue({
      groupClassId: 'group-class-uuid-1',
      userId: 'user-uuid-student',
      currentParticipants: 9,
      status: 'open',
    });

    const result = await service.cancelEnrollment('group-class-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
    expect(result.status).toBe('open');
    expect(result.currentParticipants).toBe(9);
  });

  // 业务规则: 取消成功后通知教练（§4 取消团课报名 - 业务规则 / §6.10 通知文案）
  it('should notify the coach after successful enrollment cancellation with correct notification fields', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'open',
        enrollments: [
          {
            id: 'e-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'user-uuid-student',
            enrolledAt: new Date(),
          },
        ],
      }),
    );
    repo.cancelEnrollment.mockResolvedValue({
      groupClassId: 'group-class-uuid-1',
      userId: 'user-uuid-student',
      currentParticipants: 2,
      status: 'open',
    });
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-student',
      nickname: '学员小明',
      avatarUrl: null,
      isCoach: false,
    });

    await service.cancelEnrollment('group-class-uuid-1', 'user-uuid-student');

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-coach', // 通知接收人是教练
        type: 'GROUP_CLASS_ENROLLMENT_CANCELLED',
        title: '学员取消报名',
        targetType: 'group-class',
        targetId: 'group-class-uuid-1',
      }),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 取消团课报名 - 业务规则）
  it('should not fail when notification creation fails during enrollment cancellation', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'open',
        enrollments: [
          {
            id: 'e-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'user-uuid-student',
            enrolledAt: new Date(),
          },
        ],
      }),
    );
    repo.cancelEnrollment.mockResolvedValue({
      groupClassId: 'group-class-uuid-1',
      userId: 'user-uuid-student',
      currentParticipants: 2,
      status: 'open',
    });
    notificationService.create.mockRejectedValue(new Error('Notification error'));

    const result = await service.cancelEnrollment('group-class-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_GROUP_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_GROUP_CLASS_NOT_FOUND — 团课不存在（§4 取消团课报名 - 错误码）
  it('should throw COACHING_GROUP_CLASS_NOT_FOUND when group class does not exist', async () => {
    repo.findGroupClassById.mockResolvedValue(null);

    await expect(
      service.cancelEnrollment('nonexistent-uuid', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_ENROLLED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_ENROLLED — 学员未报名该团课（§4 取消团课报名 - 错误码）
  it('should throw COACHING_NOT_ENROLLED when student is not enrolled', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', enrollments: [] }),
    );

    await expect(
      service.cancelEnrollment('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_ENROLLED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT — in_progress 状态不允许取消报名（§4 取消团课报名 - 错误码）
  it('should throw COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT when status is in_progress', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'in_progress' }),
    );

    await expect(
      service.cancelEnrollment('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT — completed 状态不允许取消报名（§4 取消团课报名 - 错误码）
  it('should throw COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT when status is completed', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'completed' }),
    );

    await expect(
      service.cancelEnrollment('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT — cancelled 状态不允许取消报名（§4 取消团课报名 - 错误码）
  it('should throw COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT when status is cancelled', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );

    await expect(
      service.cancelEnrollment('group-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// POST /api/private-lessons/availability — CoachingService.setAvailability
// ===========================================================================

describe.skip('POST /api/private-lessons/availability — CoachingService.setAvailability', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 教练可设置一个或多个空闲时间段（§4 设置私教空闲时间 - 业务规则）
  it('should create availability slots for a coach with valid input', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]); // No existing slots
    repo.createPrivateLessonSlot.mockResolvedValue([
      createSlotRecord(),
    ]);

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
          venueIds: ['venue-uuid-1'],
          feeDescription: '300元/小时',
        },
      ],
    };

    const result = await service.setAvailability('user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('slots');
  });

  // 业务规则: 支持批量设置多个时间段（§4 设置私教空闲时间 - 业务规则）
  it('should create multiple availability slots in one request', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]);
    repo.createPrivateLessonSlot.mockResolvedValue([
      createSlotRecord(),
      createSlotRecord({ id: 'slot-uuid-2' }),
    ]);

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
          venueIds: ['venue-uuid-1'],
        },
        {
          startTime: futureDate(48),
          endTime: futureDate(50),
        },
      ],
    };

    const result = await service.setAvailability('user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('slots');
  });

  // 业务规则: venueIds 为空数组时表示不限地点（§4 设置私教空闲时间 - 业务规则）
  it('should accept empty venueIds (meaning no venue restriction)', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]);
    repo.createPrivateLessonSlot.mockResolvedValue([
      createSlotRecord({ venueIds: [] }),
    ]);

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
          venueIds: [],
        },
      ],
    };

    const result = await service.setAvailability('user-uuid-coach', input);

    expect(result).toBeDefined();
  });

  // 业务规则: feeDescription 选填（§4 设置私教空闲时间 - 业务规则）
  it('should accept slot without feeDescription', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]);
    repo.createPrivateLessonSlot.mockResolvedValue([
      createSlotRecord({ feeDescription: null }),
    ]);

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
        },
      ],
    };

    const result = await service.setAvailability('user-uuid-coach', input);

    expect(result).toBeDefined();
  });

  // 业务规则: venueIds 中的每个 ID 通过 VenueService 验证存在（§4 设置私教空闲时间 - 业务规则）
  it('should validate each venueId through VenueService', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]);
    repo.createPrivateLessonSlot.mockResolvedValue([createSlotRecord()]);

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
          venueIds: ['venue-uuid-1', 'venue-uuid-2'],
        },
      ],
    };

    await service.setAvailability('user-uuid-coach', input);

    expect(venueService.getVenueById).toHaveBeenCalledWith('venue-uuid-1');
    expect(venueService.getVenueById).toHaveBeenCalledWith('venue-uuid-2');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_COACH_ROLE_REQUIRED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_COACH_ROLE_REQUIRED — 非教练角色（§4 设置私教空闲时间 - 错误码）
  it('should throw COACHING_COACH_ROLE_REQUIRED when user is not a coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-normal',
      nickname: '普通用户',
      avatarUrl: null,
      isCoach: false,
    });

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
        },
      ],
    };

    await expect(
      service.setAvailability('user-uuid-normal', input),
    ).rejects.toMatchObject({
      code: 'COACHING_COACH_ROLE_REQUIRED',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_SLOTS
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_SLOTS — slots 为空数组（§4 设置私教空闲时间 - 错误码）
  it('should throw COACHING_INVALID_SLOTS when slots is empty array', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input: SetAvailabilityInput = {
      slots: [],
    };

    await expect(
      service.setAvailability('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_SLOTS',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_SLOT_TIME
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_SLOT_TIME — startTime 不晚于当前时间（§4 设置私教空闲时间 - 错误码）
  it('should throw COACHING_INVALID_SLOT_TIME when startTime is in the past', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: new Date('2020-01-01T00:00:00.000Z').toISOString(),
          endTime: futureDate(26),
        },
      ],
    };

    await expect(
      service.setAvailability('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_SLOT_TIME',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_SLOT_TIME — endTime 不晚于 startTime（§4 设置私教空闲时间 - 错误码）
  it('should throw COACHING_INVALID_SLOT_TIME when endTime is before startTime', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(26),
          endTime: futureDate(24),
        },
      ],
    };

    await expect(
      service.setAvailability('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_SLOT_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_SLOT_TOO_SHORT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_SLOT_TOO_SHORT — 时间段时长不足 1 小时（§4 设置私教空闲时间 - 错误码）
  it('should throw COACHING_SLOT_TOO_SHORT when slot duration is less than 1 hour', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const start = futureDate(24);
    const end = new Date(
      new Date(start).getTime() + 30 * 60 * 1000, // 30 minutes
    ).toISOString();

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: start,
          endTime: end,
        },
      ],
    };

    await expect(
      service.setAvailability('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_SLOT_TOO_SHORT',
      statusCode: 400,
    });
  });

  // 边界: 时间段恰好 1 小时应通过
  it('should accept slot with exactly 1 hour duration', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]);
    repo.createPrivateLessonSlot.mockResolvedValue([createSlotRecord()]);

    const start = futureDate(24);
    const end = new Date(
      new Date(start).getTime() + 60 * 60 * 1000, // exactly 1 hour
    ).toISOString();

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: start,
          endTime: end,
        },
      ],
    };

    const result = await service.setAvailability('user-uuid-coach', input);

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_SLOT_OVERLAP
  // -----------------------------------------------------------------------

  // 错误码: COACHING_SLOT_OVERLAP — 时间段与已有时间段重叠（§4 设置私教空闲时间 - 错误码）
  it('should throw COACHING_SLOT_OVERLAP when slot overlaps with existing slot', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    // Existing slot from 10:00 to 12:00
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
      }),
    ]);

    // New slot overlaps: 11:00 to 13:00
    const overlappingStart = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
    const overlappingEnd = new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString();

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: overlappingStart,
          endTime: overlappingEnd,
        },
      ],
    };

    await expect(
      service.setAvailability('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_SLOT_OVERLAP',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_SLOT_OVERLAP — 同一批次提交的时间段之间重叠（§4 设置私教空闲时间 - 业务规则）
  it('should throw COACHING_SLOT_OVERLAP when slots within the same batch overlap', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]); // No existing slots

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
        },
        {
          startTime: futureDate(25), // Overlaps with the first slot
          endTime: futureDate(27),
        },
      ],
    };

    await expect(
      service.setAvailability('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_SLOT_OVERLAP',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_FEE_DESCRIPTION
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_FEE_DESCRIPTION — feeDescription 超过 200 字符（§4 设置私教空闲时间 - 错误码）
  it('should throw COACHING_INVALID_FEE_DESCRIPTION when feeDescription exceeds 200 chars', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
          feeDescription: 'a'.repeat(201),
        },
      ],
    };

    await expect(
      service.setAvailability('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_FEE_DESCRIPTION',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_VENUE_NOT_FOUND — venueIds 中有球馆不存在（§4 设置私教空闲时间 - 错误码）
  it('should throw COACHING_VENUE_NOT_FOUND when a venueId does not exist', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    venueService.getVenueById.mockResolvedValue(null);

    const input: SetAvailabilityInput = {
      slots: [
        {
          startTime: futureDate(24),
          endTime: futureDate(26),
          venueIds: ['nonexistent-venue-uuid'],
        },
      ],
    };

    await expect(
      service.setAvailability('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// GET /api/coaches/:id/availability — CoachingService.getCoachAvailability
// ===========================================================================

describe.skip('GET /api/coaches/:id/availability — CoachingService.getCoachAvailability', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 返回指定教练的可预约空闲时间段（§4 获取教练空闲时间 - 业务规则）
  it('should return availability slots for a valid coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({ isBooked: false }),
      createSlotRecord({ id: 'slot-uuid-2', isBooked: true }),
    ]);

    const result = await service.getCoachAvailability('user-uuid-coach');

    expect(result).toBeDefined();
    expect(result).toHaveProperty('slots');
    expect(Array.isArray(result.slots)).toBe(true);
  });

  // 业务规则: 返回所有时间段，包括已预约的（§4 获取教练空闲时间 - 业务规则）
  it('should include both booked and unbooked slots', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({ isBooked: false }),
      createSlotRecord({ id: 'slot-uuid-2', isBooked: true }),
    ]);

    const result = await service.getCoachAvailability('user-uuid-coach');

    expect(result.slots).toHaveLength(2);
  });

  // 业务规则: venues 信息通过 VenueService 批量获取（§4 获取教练空闲时间 - 业务规则）
  it('should include venue information in each slot', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({ venueIds: ['venue-uuid-1'] }),
    ]);

    const result = await service.getCoachAvailability('user-uuid-coach');

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]).toHaveProperty('venues');
  });

  // 业务规则: 返回空列表（无空闲时间段时）
  it('should return empty slots array when coach has no availability', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]);

    const result = await service.getCoachAvailability('user-uuid-coach');

    expect(result.slots).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 日期范围参数传递（§4 获取教练空闲时间 - Query Params）
  // -----------------------------------------------------------------------

  // 业务规则: startDate/endDate 参数应传递给 repo（§4 获取教练空闲时间 - Query Params）
  it('should pass startDate and endDate to repository when provided', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]);

    const startDate = '2026-04-10T00:00:00.000Z';
    const endDate = '2026-04-20T00:00:00.000Z';

    await service.getCoachAvailability('user-uuid-coach', { startDate, endDate });

    expect(repo.findAvailability).toHaveBeenCalledWith(
      expect.objectContaining({
        coachId: 'user-uuid-coach',
        startDate,
        endDate,
      }),
    );
  });

  // 业务规则: 不传日期参数时使用默认值 — startDate 默认今天，endDate 默认 startDate + 14 天（§4 获取教练空闲时间 - Query Params）
  it('should use default date range (today + 14 days) when no dates provided', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findAvailability.mockResolvedValue([]);

    const before = new Date();
    await service.getCoachAvailability('user-uuid-coach');
    const after = new Date();

    expect(repo.findAvailability).toHaveBeenCalledTimes(1);
    const callArgs = repo.findAvailability.mock.calls[0][0];

    // startDate 应为今天（调用时刻附近）
    const parsedStart = new Date(callArgs.startDate);
    expect(parsedStart.getTime()).toBeGreaterThanOrEqual(before.setHours(0, 0, 0, 0));
    expect(parsedStart.getTime()).toBeLessThanOrEqual(after.getTime());

    // endDate 应为 startDate + 14 天
    const parsedEnd = new Date(callArgs.endDate);
    const expectedEnd = new Date(parsedStart);
    expectedEnd.setDate(expectedEnd.getDate() + 14);
    // 允许 1 秒误差（测试执行时间）
    expect(Math.abs(parsedEnd.getTime() - expectedEnd.getTime())).toBeLessThan(1000);
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_A_COACH
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_A_COACH — 用户不存在（§4 获取教练空闲时间 - 错误码）
  it('should throw COACHING_NOT_A_COACH when user does not exist', async () => {
    userService.getUserById.mockResolvedValue(null);

    await expect(
      service.getCoachAvailability('nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_NOT_A_COACH — 用户不是教练角色（§4 获取教练空闲时间 - 错误码）
  it('should throw COACHING_NOT_A_COACH when user is not a coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-normal',
      nickname: '普通用户',
      avatarUrl: null,
      isCoach: false,
    });

    await expect(
      service.getCoachAvailability('user-uuid-normal'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// POST /api/private-lessons/book — CoachingService.bookPrivateLesson
// ===========================================================================

describe.skip('POST /api/private-lessons/book — CoachingService.bookPrivateLesson', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 预约成功创建 PrivateLesson，标记 slot 为 booked（§4 预约私教课 - 业务规则 / §6.6）
  it('should book a private lesson with valid input', async () => {
    repo.findPrivateLessonById.mockResolvedValue(null); // No existing booking
    // Mock finding the slot (the service may use a different method; we provide the slot via findAvailability or a dedicated method)
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        venueIds: ['venue-uuid-1'],
      }),
    ]);
    repo.bookPrivateLesson.mockResolvedValue(createPrivateLessonRecord());

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'venue-uuid-1',
    };

    const result = await service.bookPrivateLesson('user-uuid-student', input);

    expect(result).toBeDefined();
    expect(result.status).toBe('scheduled');
    expect(result.studentId).toBe('user-uuid-student');
    expect(result.coachId).toBe('user-uuid-coach');
  });

  // 业务规则: venueId 可选（当 venueIds 为空数组，不限地点时）（§4 预约私教课 - 业务规则）
  it('should allow booking without venueId when slot has no venue restriction', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        venueIds: [],
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);
    repo.bookPrivateLesson.mockResolvedValue(
      createPrivateLessonRecord({ venueId: null }),
    );

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
    };

    const result = await service.bookPrivateLesson('user-uuid-student', input);

    expect(result).toBeDefined();
  });

  // 业务规则: 若时间段未设置 venueIds 但学员提供了 venueId，需通过 VenueService 验证（§4 预约私教课 - 业务规则）
  it('should validate venueId through VenueService when provided but slot has no venue restriction', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        venueIds: [],
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);
    repo.bookPrivateLesson.mockResolvedValue(createPrivateLessonRecord());

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'venue-uuid-1',
    };

    await service.bookPrivateLesson('user-uuid-student', input);

    expect(venueService.getVenueById).toHaveBeenCalledWith('venue-uuid-1');
  });

  // 业务规则: 预约成功后通知教练（§4 预约私教课 - 业务规则 / §6.10 通知文案）
  it('should notify the coach after successful booking with correct notification fields', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        venueIds: ['venue-uuid-1'],
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);
    repo.bookPrivateLesson.mockResolvedValue(createPrivateLessonRecord());
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-student',
      nickname: '学员小明',
      avatarUrl: null,
      isCoach: false,
    });

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'venue-uuid-1',
    };

    await service.bookPrivateLesson('user-uuid-student', input);

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-coach', // 通知接收人是教练
        type: 'PRIVATE_LESSON_BOOKED',
        title: '新私教预约',
        targetType: 'private-lesson',
        targetId: 'private-lesson-uuid-1',
      }),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 预约私教课 - 业务规则）
  it('should not fail when notification creation fails during booking', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        venueIds: ['venue-uuid-1'],
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);
    repo.bookPrivateLesson.mockResolvedValue(createPrivateLessonRecord());
    notificationService.create.mockRejectedValue(new Error('Notification error'));

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'venue-uuid-1',
    };

    const result = await service.bookPrivateLesson('user-uuid-student', input);

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_SLOT_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_SLOT_NOT_FOUND — 时间段不存在（§4 预约私教课 - 错误码）
  it('should throw COACHING_SLOT_NOT_FOUND when slot does not exist', async () => {
    repo.findAvailability.mockResolvedValue([]);

    const input: BookPrivateLessonInput = {
      slotId: 'nonexistent-slot-uuid',
      venueId: 'venue-uuid-1',
    };

    await expect(
      service.bookPrivateLesson('user-uuid-student', input),
    ).rejects.toMatchObject({
      code: 'COACHING_SLOT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_SLOT_ALREADY_BOOKED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_SLOT_ALREADY_BOOKED — 时间段已被预约（§4 预约私教课 - 错误码）
  it('should throw COACHING_SLOT_ALREADY_BOOKED when slot is already booked', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: true,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'venue-uuid-1',
    };

    await expect(
      service.bookPrivateLesson('user-uuid-student', input),
    ).rejects.toMatchObject({
      code: 'COACHING_SLOT_ALREADY_BOOKED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_SLOT_EXPIRED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_SLOT_EXPIRED — 时间段已过期（§4 预约私教课 - 错误码）
  it('should throw COACHING_SLOT_EXPIRED when slot startTime is in the past', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        startTime: new Date('2020-01-01T00:00:00.000Z'),
      }),
    ]);

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'venue-uuid-1',
    };

    await expect(
      service.bookPrivateLesson('user-uuid-student', input),
    ).rejects.toMatchObject({
      code: 'COACHING_SLOT_EXPIRED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CANNOT_BOOK_OWN_LESSON
  // -----------------------------------------------------------------------

  // 错误码: COACHING_CANNOT_BOOK_OWN_LESSON — 教练预约自己的课（§4 预约私教课 - 错误码）
  it('should throw COACHING_CANNOT_BOOK_OWN_LESSON when coach books own slot', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        coachId: 'user-uuid-coach',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'venue-uuid-1',
    };

    await expect(
      service.bookPrivateLesson('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_CANNOT_BOOK_OWN_LESSON',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_REQUIRED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_VENUE_REQUIRED — 时间段设置了可选球馆但学员未提供 venueId（§4 预约私教课 - 错误码）
  it('should throw COACHING_VENUE_REQUIRED when slot has venues but no venueId provided', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        venueIds: ['venue-uuid-1', 'venue-uuid-2'],
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      // venueId not provided
    };

    await expect(
      service.bookPrivateLesson('user-uuid-student', input),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_REQUIRED',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_VENUE_CHOICE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_VENUE_CHOICE — venueId 不在可选列表中（§4 预约私教课 - 错误码）
  it('should throw COACHING_INVALID_VENUE_CHOICE when venueId not in slot venueIds', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        venueIds: ['venue-uuid-1', 'venue-uuid-2'],
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'venue-uuid-3', // not in slot's venueIds
    };

    await expect(
      service.bookPrivateLesson('user-uuid-student', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_VENUE_CHOICE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_VENUE_NOT_FOUND — 学员选择的球馆不存在（§4 预约私教课 - 错误码）
  it('should throw COACHING_VENUE_NOT_FOUND when selected venue does not exist', async () => {
    repo.findAvailability.mockResolvedValue([
      createSlotRecord({
        isBooked: false,
        venueIds: [],
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ]);
    venueService.getVenueById.mockResolvedValue(null);

    const input: BookPrivateLessonInput = {
      slotId: 'slot-uuid-1',
      venueId: 'nonexistent-venue-uuid',
    };

    await expect(
      service.bookPrivateLesson('user-uuid-student', input),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_SLOT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_SLOT — slotId 缺失或格式不合法（§4 预约私教课 - 错误码）
  it('should throw COACHING_INVALID_SLOT when slotId is empty', async () => {
    const input: BookPrivateLessonInput = {
      slotId: '',
      venueId: 'venue-uuid-1',
    };

    await expect(
      service.bookPrivateLesson('user-uuid-student', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_SLOT',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// POST /api/private-lessons/:id/cancel — CoachingService.cancelPrivateLesson
// ===========================================================================

describe.skip('POST /api/private-lessons/:id/cancel — CoachingService.cancelPrivateLesson', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 学员可取消 scheduled 状态的私教课（§4 取消私教预约 - 业务规则 / §6.7）
  it('should cancel a scheduled private lesson by student', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({ status: 'scheduled', studentId: 'user-uuid-student' }),
    );
    repo.cancelPrivateLesson.mockResolvedValue(
      createPrivateLessonRecord({ status: 'cancelled' }),
    );

    const result = await service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 教练可取消 scheduled 状态的私教课（§4 取消私教预约 - 业务规则）
  it('should cancel a scheduled private lesson by coach', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({ status: 'scheduled', coachId: 'user-uuid-coach' }),
    );
    repo.cancelPrivateLesson.mockResolvedValue(
      createPrivateLessonRecord({ status: 'cancelled' }),
    );

    const result = await service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-coach');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 已取消的私教课不可重复取消（幂等：返回当前状态，不报错）（§4 取消私教预约 - 业务规则）
  it('should return current cancelled status without error (idempotent)', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({
        status: 'cancelled',
        studentId: 'user-uuid-student',
        coachId: 'user-uuid-coach',
      }),
    );

    const result = await service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 取消成功后释放时间段（PrivateLessonSlot.isBooked = false）（§4 取消私教预约 - 业务规则 / §6.7）
  it('should release the slot when private lesson is cancelled', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({ status: 'scheduled', studentId: 'user-uuid-student' }),
    );
    repo.cancelPrivateLesson.mockResolvedValue(
      createPrivateLessonRecord({ status: 'cancelled' }),
    );

    await service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-student');

    expect(repo.cancelPrivateLesson).toHaveBeenCalled();
    // The implementation should release the slot in the same transaction
  });

  // 业务规则: 学员取消时通知教练（§4 取消私教预约 - 业务规则 / §6.10 通知文案）
  it('should notify coach when student cancels with correct notification fields', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({ status: 'scheduled', studentId: 'user-uuid-student' }),
    );
    repo.cancelPrivateLesson.mockResolvedValue(
      createPrivateLessonRecord({ status: 'cancelled' }),
    );
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-student',
      nickname: '学员小明',
      avatarUrl: null,
      isCoach: false,
    });

    await service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-student');

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-coach', // 通知接收人是教练
        type: 'PRIVATE_LESSON_CANCELLED_BY_STUDENT',
        title: '学员取消私教',
        targetType: 'private-lesson',
        targetId: 'private-lesson-uuid-1',
      }),
    );
  });

  // 业务规则: 教练取消时通知学员（§4 取消私教预约 - 业务规则 / §6.10 通知文案）
  it('should notify student when coach cancels with correct notification fields', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({ status: 'scheduled', coachId: 'user-uuid-coach' }),
    );
    repo.cancelPrivateLesson.mockResolvedValue(
      createPrivateLessonRecord({ status: 'cancelled' }),
    );

    await service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-coach');

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-student', // 通知接收人是学员
        type: 'PRIVATE_LESSON_CANCELLED_BY_COACH',
        title: '教练取消私教',
        targetType: 'coach-profile',
        targetId: 'user-uuid-coach', // 教练用户 ID（设计文档 §6.10）
      }),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 取消私教预约 - 业务规则）
  it('should not fail when notification creation fails during cancellation', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({ status: 'scheduled', studentId: 'user-uuid-student' }),
    );
    repo.cancelPrivateLesson.mockResolvedValue(
      createPrivateLessonRecord({ status: 'cancelled' }),
    );
    notificationService.create.mockRejectedValue(new Error('Notification error'));

    const result = await service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-student');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_PRIVATE_LESSON_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_LESSON_NOT_FOUND — 私教课不存在（§4 取消私教预约 - 错误码）
  it('should throw COACHING_PRIVATE_LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findPrivateLessonById.mockResolvedValue(null);

    await expect(
      service.cancelPrivateLesson('nonexistent-uuid', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_LESSON_PARTICIPANT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_LESSON_PARTICIPANT — 非学员也非教练（§4 取消私教预约 - 错误码）
  it('should throw COACHING_NOT_LESSON_PARTICIPANT when user is neither student nor coach', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({
        status: 'scheduled',
        studentId: 'user-uuid-student',
        coachId: 'user-uuid-coach',
      }),
    );

    await expect(
      service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-other'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_LESSON_PARTICIPANT',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_NOT_CANCELLABLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_NOT_CANCELLABLE — in_progress 状态不允许取消（§4 取消私教预约 - 错误码）
  it('should throw COACHING_LESSON_NOT_CANCELLABLE when status is in_progress', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({
        status: 'in_progress',
        studentId: 'user-uuid-student',
      }),
    );

    await expect(
      service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_LESSON_NOT_CANCELLABLE — completed 状态不允许取消（§4 取消私教预约 - 错误码）
  it('should throw COACHING_LESSON_NOT_CANCELLABLE when status is completed', async () => {
    repo.findPrivateLessonById.mockResolvedValue(
      createPrivateLessonRecord({
        status: 'completed',
        studentId: 'user-uuid-student',
      }),
    );

    await expect(
      service.cancelPrivateLesson('private-lesson-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// GET /api/users/:id/enrollments — CoachingService.getUserEnrollments
// ===========================================================================

describe.skip('GET /api/users/:id/enrollments — CoachingService.getUserEnrollments', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 合并团课报名和私教预约两种类型（§4 用户的课程报名列表 - 业务规则）
  it('should return merged list of group class enrollments and private lessons', async () => {
    repo.findUserEnrollments.mockResolvedValue({
      items: [
        {
          type: 'group-class',
          groupClass: {
            id: 'gc-1',
            title: '团课1',
            coachId: 'user-uuid-coach',
            startTime: new Date('2026-04-10T14:00:00.000Z'),
            endTime: new Date('2026-04-10T16:00:00.000Z'),
            status: 'open',
            enrolledAt: new Date('2026-04-03T09:00:00.000Z'),
          },
          privateLesson: null,
        },
        {
          type: 'private-lesson',
          groupClass: null,
          privateLesson: {
            id: 'pl-1',
            coachId: 'user-uuid-coach',
            startTime: new Date('2026-04-11T10:00:00.000Z'),
            endTime: new Date('2026-04-11T12:00:00.000Z'),
            status: 'scheduled',
            createdAt: new Date('2026-04-03T10:00:00.000Z'),
          },
        },
      ],
      total: 2,
    });

    const result = await service.getUserEnrollments('user-uuid-student', {});

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  // 业务规则: 当 userId 对应的用户不存在时，返回空列表（§4 用户的课程报名列表 - 业务规则）
  it('should return empty list when user does not exist (not expose user existence)', async () => {
    repo.findUserEnrollments.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getUserEnrollments('nonexistent-uuid', {});

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  // 业务规则: 任何已登录用户均可查看（§4 用户的课程报名列表 - 业务规则）
  it('should allow any authenticated user to view enrollments', async () => {
    repo.findUserEnrollments.mockResolvedValue({ items: [], total: 0 });

    // Should not throw for any userId
    const result = await service.getUserEnrollments('any-user-uuid', {});

    expect(result).toBeDefined();
  });

  // 业务规则: 分页支持默认值（§4 用户的课程报名列表 - Query Params）
  it('should use default pagination when not provided', async () => {
    repo.findUserEnrollments.mockResolvedValue({ items: [], total: 0 });

    await service.getUserEnrollments('user-uuid-student', {});

    expect(repo.findUserEnrollments).toHaveBeenCalledWith(
      'user-uuid-student',
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  // 业务规则: 教练昵称通过 UserService.getUsersByIds() 批量获取（§4 用户的课程报名列表 - 业务规则）
  it('should include coach nickname in enrollment items', async () => {
    repo.findUserEnrollments.mockResolvedValue({
      items: [
        {
          type: 'group-class',
          groupClass: {
            id: 'gc-1',
            title: '团课1',
            coachId: 'user-uuid-coach',
            startTime: new Date(),
            endTime: new Date(),
            status: 'open',
            enrolledAt: new Date(),
          },
          privateLesson: null,
        },
      ],
      total: 1,
    });
    userService.getUsersByIds.mockResolvedValue([
      { id: 'user-uuid-coach', nickname: '教练张', avatarUrl: null },
    ]);

    const result = await service.getUserEnrollments('user-uuid-student', {});

    expect(result.items[0].groupClass).toHaveProperty('coachNickname');
  });

  // -----------------------------------------------------------------------
  // type/status 筛选 (MF-4)
  // -----------------------------------------------------------------------

  // 业务规则: type 筛选 — 仅返回指定类型的记录（§4 用户的课程报名列表 - Query Params / 业务规则）
  it('should filter enrollments by type=group-class', async () => {
    repo.findUserEnrollments.mockResolvedValue({
      items: [
        {
          type: 'group-class',
          groupClass: {
            id: 'gc-1',
            title: '团课1',
            coachId: 'user-uuid-coach',
            startTime: new Date(),
            endTime: new Date(),
            status: 'open',
            enrolledAt: new Date(),
          },
          privateLesson: null,
        },
      ],
      total: 1,
    });

    const query: EnrollmentListQuery = { type: 'group-class' };
    const result = await service.getUserEnrollments('user-uuid-student', query);

    expect(result).toBeDefined();
    expect(repo.findUserEnrollments).toHaveBeenCalledWith(
      'user-uuid-student',
      expect.objectContaining({ type: 'group-class' }),
    );
  });

  // 业务规则: type 筛选 — 仅返回 private-lesson 类型（§4 用户的课程报名列表 - Query Params / 业务规则）
  it('should filter enrollments by type=private-lesson', async () => {
    repo.findUserEnrollments.mockResolvedValue({
      items: [
        {
          type: 'private-lesson',
          groupClass: null,
          privateLesson: {
            id: 'pl-1',
            coachId: 'user-uuid-coach',
            startTime: new Date(),
            endTime: new Date(),
            status: 'scheduled',
            createdAt: new Date(),
          },
        },
      ],
      total: 1,
    });

    const query: EnrollmentListQuery = { type: 'private-lesson' };
    const result = await service.getUserEnrollments('user-uuid-student', query);

    expect(result).toBeDefined();
    expect(repo.findUserEnrollments).toHaveBeenCalledWith(
      'user-uuid-student',
      expect.objectContaining({ type: 'private-lesson' }),
    );
  });

  // 业务规则: status 筛选 — 团课报名的状态取关联团课的 status（§4 用户的课程报名列表 - 业务规则）
  it('should filter enrollments by status', async () => {
    repo.findUserEnrollments.mockResolvedValue({
      items: [
        {
          type: 'group-class',
          groupClass: {
            id: 'gc-1',
            title: '团课1',
            coachId: 'user-uuid-coach',
            startTime: new Date(),
            endTime: new Date(),
            status: 'open',
            enrolledAt: new Date(),
          },
          privateLesson: null,
        },
      ],
      total: 1,
    });

    const query: EnrollmentListQuery = { status: 'open' };
    const result = await service.getUserEnrollments('user-uuid-student', query);

    expect(result).toBeDefined();
    expect(repo.findUserEnrollments).toHaveBeenCalledWith(
      'user-uuid-student',
      expect.objectContaining({ status: 'open' }),
    );
  });

  // 业务规则: type 和 status 组合筛选（§4 用户的课程报名列表 - 业务规则）
  it('should filter enrollments by both type and status', async () => {
    repo.findUserEnrollments.mockResolvedValue({ items: [], total: 0 });

    const query: EnrollmentListQuery = { type: 'private-lesson', status: 'scheduled' };
    const result = await service.getUserEnrollments('user-uuid-student', query);

    expect(result).toBeDefined();
    expect(repo.findUserEnrollments).toHaveBeenCalledWith(
      'user-uuid-student',
      expect.objectContaining({ type: 'private-lesson', status: 'scheduled' }),
    );
  });
});

// ===========================================================================
// GET /api/coaches/:id/private-lessons — CoachingService.getCoachPrivateLessons
// ===========================================================================

describe.skip('GET /api/coaches/:id/private-lessons — CoachingService.getCoachPrivateLessons', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 返回教练的私教预约列表，包含学员信息（§4 教练的私教预约列表 - 业务规则）
  it('should return private lessons list with student info for a valid coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachPrivateLessons.mockResolvedValue({
      items: [
        createPrivateLessonRecord(),
      ],
      total: 1,
    });
    userService.getUsersByIds.mockResolvedValue([
      { id: 'user-uuid-student', nickname: '学员小明', avatarUrl: null },
    ]);

    const result = await service.getCoachPrivateLessons('user-uuid-coach', {});

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  // 业务规则: 返回空列表（无私教预约时）
  it('should return empty list when coach has no private lessons', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachPrivateLessons.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getCoachPrivateLessons('user-uuid-coach', {});

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  // 业务规则: 分页支持默认值（§4 教练的私教预约列表 - Query Params）
  it('should use default pagination when not provided', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachPrivateLessons.mockResolvedValue({ items: [], total: 0 });

    await service.getCoachPrivateLessons('user-uuid-coach', {});

    expect(repo.findCoachPrivateLessons).toHaveBeenCalledWith(
      'user-uuid-coach',
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  // 业务规则: status 筛选（§4 教练的私教预约列表 - Query Params）
  it('should pass status filter to repository', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachPrivateLessons.mockResolvedValue({ items: [], total: 0 });

    await service.getCoachPrivateLessons('user-uuid-coach', { status: 'scheduled' });

    expect(repo.findCoachPrivateLessons).toHaveBeenCalledWith(
      'user-uuid-coach',
      expect.objectContaining({ status: 'scheduled' }),
    );
  });

  // 业务规则: venue 为 null 时返回 null（§4 教练的私教预约列表 - 业务规则）
  it('should handle null venue in private lesson items', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachPrivateLessons.mockResolvedValue({
      items: [createPrivateLessonRecord({ venueId: null })],
      total: 1,
    });
    userService.getUsersByIds.mockResolvedValue([
      { id: 'user-uuid-student', nickname: '学员小明', avatarUrl: null },
    ]);

    const result = await service.getCoachPrivateLessons('user-uuid-coach', {});

    expect(result.items).toHaveLength(1);
    // venue should be null when venueId is null
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_A_COACH
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_A_COACH — 用户不存在（§4 教练的私教预约列表 - 错误码）
  it('should throw COACHING_NOT_A_COACH when user does not exist', async () => {
    userService.getUserById.mockResolvedValue(null);

    await expect(
      service.getCoachPrivateLessons('nonexistent-uuid', {}),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_NOT_A_COACH — 用户不是教练角色（§4 教练的私教预约列表 - 错误码）
  it('should throw COACHING_NOT_A_COACH when user is not a coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-normal',
      nickname: '普通用户',
      avatarUrl: null,
      isCoach: false,
    });

    await expect(
      service.getCoachPrivateLessons('user-uuid-normal', {}),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// CoachingService.getPrivateLessonById — 跨模块 Service 调用
// ===========================================================================

describe.skip('CoachingService.getPrivateLessonById — cross-module service', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // 业务规则: 私教课不存在时返回 null（§4 跨模块接口 - getPrivateLessonById）
  it('should return null when private lesson does not exist', async () => {
    repo.findPrivateLessonById.mockResolvedValue(null);

    const result = await service.getPrivateLessonById('nonexistent-uuid');

    expect(result).toBeNull();
  });

  // 业务规则: 返回字段包含 id, coachId, studentId, venueId, startTime, endTime, status（§4 跨模块接口 - getPrivateLessonById）
  it('should return private lesson fields for caller validation', async () => {
    repo.findPrivateLessonById.mockResolvedValue(createPrivateLessonRecord());

    const result = await service.getPrivateLessonById('private-lesson-uuid-1');

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: expect.any(String),
      coachId: expect.any(String),
      studentId: expect.any(String),
      startTime: expect.any(Date),
      endTime: expect.any(Date),
      status: expect.any(String),
    });
  });
});

// ===========================================================================
// CoachingService.getParticipantIds — 跨模块 Service 调用
// ===========================================================================

describe.skip('CoachingService.getParticipantIds — cross-module service', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // 业务规则: group-class 返回报名学员 + 教练（§4 跨模块接口 - getParticipantIds）
  it('should return all participant IDs including coach for group-class', async () => {
    repo.getGroupClassParticipantIds.mockResolvedValue([
      'user-uuid-coach',
      'student-uuid-1',
      'student-uuid-2',
    ]);

    const result = await service.getParticipantIds('group-class-uuid-1', 'group-class');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  // 业务规则: private-lesson 返回学员 + 教练（§4 跨模块接口 - getParticipantIds）
  it('should return student and coach IDs for private-lesson', async () => {
    repo.getPrivateLessonParticipantIds.mockResolvedValue([
      'user-uuid-coach',
      'user-uuid-student',
    ]);

    const result = await service.getParticipantIds('private-lesson-uuid-1', 'private-lesson');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  // 业务规则: 课程不存在时返回空数组（§4 跨模块接口 - getParticipantIds）
  it('should return empty array when group class does not exist', async () => {
    repo.getGroupClassParticipantIds.mockResolvedValue([]);

    const result = await service.getParticipantIds('nonexistent-uuid', 'group-class');

    expect(result).toEqual([]);
  });

  // 业务规则: 私教课不存在时返回空数组（§4 跨模块接口 - getParticipantIds）
  it('should return empty array when private lesson does not exist', async () => {
    repo.getPrivateLessonParticipantIds.mockResolvedValue([]);

    const result = await service.getParticipantIds('nonexistent-uuid', 'private-lesson');

    expect(result).toEqual([]);
  });
});

// ===========================================================================
// 定时任务: 课程状态自动流转 — CoachingService.processStatusTransitions (MF-1)
// ===========================================================================

describe.skip('定时任务: 课程状态自动流转 — CoachingService.processStatusTransitions', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 团课状态流转（§6.3 定时任务 — 课程状态自动流转）
  // -----------------------------------------------------------------------

  // 业务规则: open/full → in_progress（startTime 已过）（§6.1 团课状态机 / §6.3）
  it('should transition group classes from open/full to in_progress when startTime has passed', async () => {
    repo.updateGroupClassesStarted.mockResolvedValue(3);
    repo.updateGroupClassesCompleted.mockResolvedValue(0);
    repo.updatePrivateLessonsStarted.mockResolvedValue(0);
    repo.updatePrivateLessonsCompleted.mockResolvedValue(0);

    await service.processStatusTransitions();

    expect(repo.updateGroupClassesStarted).toHaveBeenCalledWith(expect.any(Date));
  });

  // 业务规则: in_progress → completed（endTime 已过）（§6.1 团课状态机 / §6.3）
  it('should transition group classes from in_progress to completed when endTime has passed', async () => {
    repo.updateGroupClassesStarted.mockResolvedValue(0);
    repo.updateGroupClassesCompleted.mockResolvedValue(2);
    repo.updatePrivateLessonsStarted.mockResolvedValue(0);
    repo.updatePrivateLessonsCompleted.mockResolvedValue(0);

    await service.processStatusTransitions();

    expect(repo.updateGroupClassesCompleted).toHaveBeenCalledWith(expect.any(Date));
  });

  // -----------------------------------------------------------------------
  // 私教课状态流转（§6.3 定时任务 — 课程状态自动流转）
  // -----------------------------------------------------------------------

  // 业务规则: scheduled → in_progress（startTime 已过）（§6.2 私教课状态机 / §6.3）
  it('should transition private lessons from scheduled to in_progress when startTime has passed', async () => {
    repo.updateGroupClassesStarted.mockResolvedValue(0);
    repo.updateGroupClassesCompleted.mockResolvedValue(0);
    repo.updatePrivateLessonsStarted.mockResolvedValue(1);
    repo.updatePrivateLessonsCompleted.mockResolvedValue(0);

    await service.processStatusTransitions();

    expect(repo.updatePrivateLessonsStarted).toHaveBeenCalledWith(expect.any(Date));
  });

  // 业务规则: in_progress → completed（endTime 已过）（§6.2 私教课状态机 / §6.3）
  it('should transition private lessons from in_progress to completed when endTime has passed', async () => {
    repo.updateGroupClassesStarted.mockResolvedValue(0);
    repo.updateGroupClassesCompleted.mockResolvedValue(0);
    repo.updatePrivateLessonsStarted.mockResolvedValue(0);
    repo.updatePrivateLessonsCompleted.mockResolvedValue(4);

    await service.processStatusTransitions();

    expect(repo.updatePrivateLessonsCompleted).toHaveBeenCalledWith(expect.any(Date));
  });

  // -----------------------------------------------------------------------
  // 完整流转一轮（§6.3）
  // -----------------------------------------------------------------------

  // 业务规则: 一次执行中同时处理团课和私教课的所有状态流转（§6.3）
  it('should process all four transitions in a single invocation', async () => {
    repo.updateGroupClassesStarted.mockResolvedValue(2);
    repo.updateGroupClassesCompleted.mockResolvedValue(1);
    repo.updatePrivateLessonsStarted.mockResolvedValue(3);
    repo.updatePrivateLessonsCompleted.mockResolvedValue(1);

    await service.processStatusTransitions();

    expect(repo.updateGroupClassesStarted).toHaveBeenCalled();
    expect(repo.updateGroupClassesCompleted).toHaveBeenCalled();
    expect(repo.updatePrivateLessonsStarted).toHaveBeenCalled();
    expect(repo.updatePrivateLessonsCompleted).toHaveBeenCalled();
  });

  // 业务规则: 无需流转时正常完成，不报错（§6.3）
  it('should complete without error when there are no transitions to process', async () => {
    repo.updateGroupClassesStarted.mockResolvedValue(0);
    repo.updateGroupClassesCompleted.mockResolvedValue(0);
    repo.updatePrivateLessonsStarted.mockResolvedValue(0);
    repo.updatePrivateLessonsCompleted.mockResolvedValue(0);

    await expect(service.processStatusTransitions()).resolves.not.toThrow();
  });

  // -----------------------------------------------------------------------
  // 异常处理（§6.3 注意事项）
  // -----------------------------------------------------------------------

  // 业务规则: 定时任务异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性（§6.3）
  it('should catch exceptions and not throw when repository operations fail', async () => {
    repo.updateGroupClassesStarted.mockRejectedValue(new Error('DB connection lost'));
    repo.updateGroupClassesCompleted.mockResolvedValue(0);
    repo.updatePrivateLessonsStarted.mockResolvedValue(0);
    repo.updatePrivateLessonsCompleted.mockResolvedValue(0);

    // processStatusTransitions should swallow the error
    await expect(service.processStatusTransitions()).resolves.not.toThrow();
  });

  // 业务规则: 私教课状态流转异常不影响团课流转结果（§6.3）
  it('should handle partial failure — private lesson error does not block group class transitions', async () => {
    repo.updateGroupClassesStarted.mockResolvedValue(2);
    repo.updateGroupClassesCompleted.mockResolvedValue(1);
    repo.updatePrivateLessonsStarted.mockRejectedValue(new Error('DB error'));
    repo.updatePrivateLessonsCompleted.mockResolvedValue(0);

    await expect(service.processStatusTransitions()).resolves.not.toThrow();

    // Group class transitions should still have been attempted
    expect(repo.updateGroupClassesStarted).toHaveBeenCalled();
    expect(repo.updateGroupClassesCompleted).toHaveBeenCalled();
  });
});
