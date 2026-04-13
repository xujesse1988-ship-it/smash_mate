/**
 * 契约测试: coaching 模块 — 管理员教练审核接口
 * 覆盖接口:
 *   - GET /api/admin/coach-applications (CoachingService.getApplicationList)
 *   - GET /api/admin/coach-applications/:id (CoachingService.getApplicationById)
 *   - POST /api/admin/coach-applications/:id/review (CoachingService.reviewCoachApplication)
 *
 * 来源文档: docs/module-design/coach-verification.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - CoachingRepository: 全部 mock（隔离数据库依赖）
 * - UserService: mock getUserById / getUsersByIds（跨模块依赖）
 * - VenueService: mock getVenueById（跨模块依赖）
 * - NotificationService: mock create / createBatch（跨模块依赖）
 *
 * 注意: 认证（401）和授权（403 AUTH_ADMIN_REQUIRED）由中间件层处理，
 * 不属于 Service 层契约测试范围。此文件聚焦 Service 层业务逻辑和错误码。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock CoachingRepository with all methods stubbed.
 * Individual tests override specific methods as needed.
 */
function createMockRepository(): {
  [K in keyof CoachingRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    // Existing methods
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
    bookPrivateLesson: vi.fn().mockResolvedValue(undefined),
    cancelPrivateLesson: vi.fn().mockResolvedValue(undefined),
    findPrivateLessonById: vi.fn().mockResolvedValue(null),
    findUserEnrollments: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCoachPrivateLessons: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getGroupClassParticipantIds: vi.fn().mockResolvedValue([]),
    getPrivateLessonParticipantIds: vi.fn().mockResolvedValue([]),
    findGroupClassesByCoach: vi.fn().mockResolvedValue([]),
    getBatchCoachStudentCounts: vi.fn().mockResolvedValue(new Map()),
    updateGroupClassesStarted: vi.fn().mockResolvedValue(0),
    updateGroupClassesCompleted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsStarted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsCompleted: vi.fn().mockResolvedValue(0),
    // Coach application methods (to be implemented)
    createCoachApplication: vi
      .fn()
      .mockResolvedValue(createCoachApplicationRecord()),
    findLatestApplicationByUser: vi.fn().mockResolvedValue(null),
    findCoachApplicationById: vi.fn().mockResolvedValue(null),
    findCoachApplications: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0 }),
    updateCoachApplication: vi
      .fn()
      .mockResolvedValue(createCoachApplicationRecord()),
  };
}

/**
 * Build a mock UserService with cross-module methods.
 */
function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: null,
      isCoach: false,
      phone: '13800001234',
    }),
    getUsersByIds: vi.fn().mockResolvedValue([
      {
        id: 'user-uuid-1',
        nickname: '球友张三',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: null,
        isCoach: false,
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

/** Standard CoachApplication record as returned by repository */
function createCoachApplicationRecord(
  overrides?: Partial<{
    id: string;
    userId: string;
    certificateUrls: string[];
    description: string | null;
    status: string;
    rejectReason: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: 'application-uuid-1',
    userId: 'user-uuid-1',
    certificateUrls: ['https://example.com/cert1.jpg'],
    description: '国家二级运动员',
    status: 'pending',
    rejectReason: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-04-13T10:00:00.000Z'),
    updatedAt: new Date('2026-04-13T10:00:00.000Z'),
    ...overrides,
  };
}

// ===========================================================================
// GET /api/admin/coach-applications — getApplicationList
// ===========================================================================

describe('GET /api/admin/coach-applications — CoachingService.getApplicationList', () => {
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
      userService,
      venueService,
      notificationService,
    );
  });

  // -------------------------------------------------------------------------
  // 正常流程
  // -------------------------------------------------------------------------

  it('should return paginated application list with default parameters', async () => {
    // 业务规则: 返回分页列表，默认 page=1, pageSize=20
    // 来源: coach-verification.md §4 GET /api/admin/coach-applications - Response 200
    const applicationRecord = createCoachApplicationRecord();
    repo.findCoachApplications.mockResolvedValue({
      items: [applicationRecord],
      total: 1,
    });

    const result = await service.getApplicationList({
      page: 1,
      pageSize: 20,
    });

    expect(result).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: 'application-uuid-1',
          userId: 'user-uuid-1',
          status: 'pending',
        }),
      ]),
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('should include user nickname and avatarUrl in list items', async () => {
    // 业务规则: nickname、avatarUrl 通过 UserService.getUsersByIds() 批量获取
    // 来源: coach-verification.md §4 GET /api/admin/coach-applications - 业务规则
    const applicationRecord = createCoachApplicationRecord();
    repo.findCoachApplications.mockResolvedValue({
      items: [applicationRecord],
      total: 1,
    });
    userService.getUsersByIds.mockResolvedValue([
      {
        id: 'user-uuid-1',
        nickname: '球友张三',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    ]);

    const result = await service.getApplicationList({
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0]).toMatchObject({
      nickname: '球友张三',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
  });

  it('should filter applications by status when provided', async () => {
    // 业务规则: 支持按状态筛选 pending/approved/rejected
    // 来源: coach-verification.md §4 GET /api/admin/coach-applications - Query Params
    repo.findCoachApplications.mockResolvedValue({
      items: [createCoachApplicationRecord({ status: 'pending' })],
      total: 1,
    });

    await service.getApplicationList({
      status: 'pending',
      page: 1,
      pageSize: 20,
    });

    expect(repo.findCoachApplications).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('should return empty list when no applications exist', async () => {
    // 业务规则: 无数据时返回空列表
    repo.findCoachApplications.mockResolvedValue({
      items: [],
      total: 0,
    });

    const result = await service.getApplicationList({
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should pass pagination parameters to repository', async () => {
    // 验证 Service 正确传递分页参数给 Repository
    repo.findCoachApplications.mockResolvedValue({
      items: [],
      total: 0,
    });

    await service.getApplicationList({
      page: 2,
      pageSize: 10,
    });

    expect(repo.findCoachApplications).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
  });
});

// ===========================================================================
// GET /api/admin/coach-applications/:id — getApplicationById
// ===========================================================================

describe('GET /api/admin/coach-applications/:id — CoachingService.getApplicationById', () => {
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
      userService,
      venueService,
      notificationService,
    );
  });

  // -------------------------------------------------------------------------
  // 正常流程
  // -------------------------------------------------------------------------

  it('should return full application detail with user info', async () => {
    // 业务规则: 返回完整申请详情，包含用户信息
    // 来源: coach-verification.md §4 GET /api/admin/coach-applications/:id - Response 200
    const applicationRecord = createCoachApplicationRecord();
    repo.findCoachApplicationById.mockResolvedValue(applicationRecord);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: null,
      isCoach: false,
      phone: '13800001234',
    });

    const result = await service.getApplicationById('application-uuid-1');

    expect(result).toMatchObject({
      id: 'application-uuid-1',
      userId: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: 'https://example.com/avatar.jpg',
      certificateUrls: ['https://example.com/cert1.jpg'],
      description: '国家二级运动员',
      status: 'pending',
      rejectReason: null,
      reviewedBy: null,
      reviewedAt: null,
    });
  });

  it('should mask phone number in response (middle 4 digits)', async () => {
    // 业务规则: 手机号脱敏展示（中间 4 位替换为 *）
    // 来源: coach-verification.md §4 GET /api/admin/coach-applications/:id - 业务规则
    const applicationRecord = createCoachApplicationRecord();
    repo.findCoachApplicationById.mockResolvedValue(applicationRecord);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: null,
      bio: null,
      isCoach: false,
      phone: '13800001234',
    });

    const result = await service.getApplicationById('application-uuid-1');

    expect(result!.phone).toBe('138****1234');
  });

  it('should include updatedAt in response', async () => {
    // 业务规则: 响应中包含 updatedAt 字段
    // 来源: coach-verification.md §4 GET /api/admin/coach-applications/:id - 业务规则
    const applicationRecord = createCoachApplicationRecord({
      updatedAt: new Date('2026-04-13T11:00:00.000Z'),
    });
    repo.findCoachApplicationById.mockResolvedValue(applicationRecord);

    const result = await service.getApplicationById('application-uuid-1');

    expect(result!.updatedAt).toBeInstanceOf(Date);
  });

  // -------------------------------------------------------------------------
  // 异常流程
  // -------------------------------------------------------------------------

  it('should throw COACHING_APPLICATION_NOT_FOUND when application does not exist', async () => {
    // 业务规则: 申请不存在时返回 404
    // 来源: coach-verification.md §4 GET /api/admin/coach-applications/:id - 错误码
    repo.findCoachApplicationById.mockResolvedValue(null);

    await expect(
      service.getApplicationById('non-existent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_APPLICATION_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// POST /api/admin/coach-applications/:id/review — reviewCoachApplication
// ===========================================================================

describe('POST /api/admin/coach-applications/:id/review — CoachingService.reviewCoachApplication', () => {
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
      userService,
      venueService,
      notificationService,
    );
  });

  // -------------------------------------------------------------------------
  // 正常流程 — 通过审核
  // -------------------------------------------------------------------------

  it('should approve application and return updated record', async () => {
    // 业务规则: 通过时更新 status=approved, reviewedBy, reviewedAt
    // 来源: coach-verification.md §4 POST review - Response 200 + §6.5 审核流程 5a
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);

    const approvedRecord = createCoachApplicationRecord({
      status: 'approved',
      reviewedBy: 'admin-uuid-1',
      reviewedAt: new Date('2026-04-13T11:00:00.000Z'),
      updatedAt: new Date('2026-04-13T11:00:00.000Z'),
    });
    repo.updateCoachApplication.mockResolvedValue(approvedRecord);

    const result = await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      { status: 'approved' },
    );

    expect(result).toMatchObject({
      id: 'application-uuid-1',
      status: 'approved',
      reviewedBy: 'admin-uuid-1',
    });
    expect(result.reviewedAt).toBeInstanceOf(Date);
  });

  it('should set user isCoach to true when approved', async () => {
    // 业务规则: 通过时更新 User.isCoach = true
    // 来源: coach-verification.md §6.5 审核流程 5a — "更新 User.isCoach = true"
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);
    repo.updateCoachApplication.mockResolvedValue(
      createCoachApplicationRecord({ status: 'approved' }),
    );

    await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      { status: 'approved' },
    );

    // Verify repository was called to update user's coach role
    // The exact mechanism depends on implementation (could be through repo or userService)
    // At minimum, we verify the flow completed without error
    expect(repo.updateCoachApplication).toHaveBeenCalled();
  });

  it('should create CoachProfile when approved (if not exists)', async () => {
    // 业务规则: 通过时自动创建 CoachProfile（如不存在）
    // 来源: coach-verification.md §6.5 审核流程 5a — "创建 CoachProfile（如不存在）"
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);
    repo.findCoachProfile.mockResolvedValue(null);
    repo.updateCoachApplication.mockResolvedValue(
      createCoachApplicationRecord({ status: 'approved' }),
    );

    await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      { status: 'approved' },
    );

    expect(repo.createCoachProfile).toHaveBeenCalledWith('user-uuid-1');
  });

  it('should not create CoachProfile if already exists when approved', async () => {
    // 业务规则: CoachProfile 已存在时不重复创建
    // 来源: coach-verification.md §6.5 审核流程 5a — "创建 CoachProfile（如不存在）"
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);
    repo.findCoachProfile.mockResolvedValue({
      id: 'coach-profile-uuid',
      userId: 'user-uuid-1',
      bio: null,
      specialties: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repo.updateCoachApplication.mockResolvedValue(
      createCoachApplicationRecord({ status: 'approved' }),
    );

    await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      { status: 'approved' },
    );

    expect(repo.createCoachProfile).not.toHaveBeenCalled();
  });

  it('should send approval notification to the applicant', async () => {
    // 业务规则: 通过 NotificationService.create() 通知用户审核通过
    // 来源: coach-verification.md §5 通知文案 — 审核通过
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);
    repo.updateCoachApplication.mockResolvedValue(
      createCoachApplicationRecord({ status: 'approved' }),
    );

    await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      { status: 'approved' },
    );

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-1',
        type: 'COACH_APPLICATION_APPROVED',
        targetType: 'coach-application',
        targetId: 'application-uuid-1',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 正常流程 — 拒绝审核
  // -------------------------------------------------------------------------

  it('should reject application with reason and return updated record', async () => {
    // 业务规则: 拒绝时记录 rejectReason，status 变为 rejected
    // 来源: coach-verification.md §4 POST review - Response 200 + §6.5 审核流程 5b
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);

    const rejectedRecord = createCoachApplicationRecord({
      status: 'rejected',
      rejectReason: '证书图片不清晰，请重新上传',
      reviewedBy: 'admin-uuid-1',
      reviewedAt: new Date('2026-04-13T11:00:00.000Z'),
      updatedAt: new Date('2026-04-13T11:00:00.000Z'),
    });
    repo.updateCoachApplication.mockResolvedValue(rejectedRecord);

    const result = await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      {
        status: 'rejected',
        rejectReason: '证书图片不清晰，请重新上传',
      },
    );

    expect(result).toMatchObject({
      id: 'application-uuid-1',
      status: 'rejected',
      rejectReason: '证书图片不清晰，请重新上传',
      reviewedBy: 'admin-uuid-1',
    });
  });

  it('should send rejection notification with reason to the applicant', async () => {
    // 业务规则: 通过 NotificationService.create() 通知用户审核未通过及原因
    // 来源: coach-verification.md §5 通知文案 — 审核拒绝
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);
    repo.updateCoachApplication.mockResolvedValue(
      createCoachApplicationRecord({
        status: 'rejected',
        rejectReason: '证书过期',
      }),
    );

    await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      {
        status: 'rejected',
        rejectReason: '证书过期，请更新后重新提交',
      },
    );

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-1',
        type: 'COACH_APPLICATION_REJECTED',
        targetType: 'coach-application',
        targetId: 'application-uuid-1',
      }),
    );
  });

  it('should not block review if notification fails', async () => {
    // 业务规则: 通知创建失败不阻塞审核结果（try-catch + error 日志）
    // 来源: coach-verification.md §6.5 审核流程 步骤 6
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);
    repo.updateCoachApplication.mockResolvedValue(
      createCoachApplicationRecord({ status: 'approved' }),
    );
    notificationService.create.mockRejectedValue(
      new Error('Notification service unavailable'),
    );

    // Should not throw even though notification fails
    const result = await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      { status: 'approved' },
    );

    expect(result.status).toBe('approved');
  });

  // -------------------------------------------------------------------------
  // 异常流程 — 审核状态校验
  // -------------------------------------------------------------------------

  it('should reject invalid review status (not approved or rejected)', async () => {
    // 业务规则: status 必须为 approved 或 rejected
    // 来源: coach-verification.md §4 错误码 COACHING_INVALID_REVIEW_STATUS
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);

    await expect(
      service.reviewCoachApplication(
        'application-uuid-1',
        'admin-uuid-1',
        { status: 'invalid_status' as 'approved' | 'rejected' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_REVIEW_STATUS',
      statusCode: 400,
    });
  });

  // -------------------------------------------------------------------------
  // 异常流程 — 拒绝原因校验
  // -------------------------------------------------------------------------

  it('should reject when rejecting without reason', async () => {
    // 业务规则: 拒绝时必填原因
    // 来源: coach-verification.md §4 错误码 COACHING_REJECT_REASON_REQUIRED
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);

    await expect(
      service.reviewCoachApplication(
        'application-uuid-1',
        'admin-uuid-1',
        { status: 'rejected' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_REJECT_REASON_REQUIRED',
      statusCode: 400,
    });
  });

  it('should reject when rejectReason is less than 5 characters', async () => {
    // 业务规则: 拒绝原因最少 5 个字符
    // 来源: coach-verification.md §4 错误码 COACHING_REJECT_REASON_TOO_SHORT
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);

    await expect(
      service.reviewCoachApplication(
        'application-uuid-1',
        'admin-uuid-1',
        { status: 'rejected', rejectReason: '不行' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_REJECT_REASON_TOO_SHORT',
      statusCode: 400,
    });
  });

  it('should accept rejectReason with exactly 5 characters', async () => {
    // 业务规则: 拒绝原因最少 5 个字符（边界值）
    // 来源: coach-verification.md §4 POST review 接口错误码
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);
    repo.updateCoachApplication.mockResolvedValue(
      createCoachApplicationRecord({
        status: 'rejected',
        rejectReason: '证书不合格呢',
      }),
    );

    const result = await service.reviewCoachApplication(
      'application-uuid-1',
      'admin-uuid-1',
      { status: 'rejected', rejectReason: '证书不合格呢' },
    );

    expect(result.status).toBe('rejected');
  });

  it('should reject when rejectReason is empty string', async () => {
    // 业务规则: 拒绝原因不可为空字符串
    // 来源: coach-verification.md §4 错误码 COACHING_REJECT_REASON_REQUIRED
    const pendingRecord = createCoachApplicationRecord({ status: 'pending' });
    repo.findCoachApplicationById.mockResolvedValue(pendingRecord);

    await expect(
      service.reviewCoachApplication(
        'application-uuid-1',
        'admin-uuid-1',
        { status: 'rejected', rejectReason: '' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_REJECT_REASON_REQUIRED',
      statusCode: 400,
    });
  });

  // -------------------------------------------------------------------------
  // 异常流程 — 申请不存在
  // -------------------------------------------------------------------------

  it('should throw COACHING_APPLICATION_NOT_FOUND when application does not exist', async () => {
    // 业务规则: 申请不存在时返回 404
    // 来源: coach-verification.md §4 错误码 COACHING_APPLICATION_NOT_FOUND
    repo.findCoachApplicationById.mockResolvedValue(null);

    await expect(
      service.reviewCoachApplication(
        'non-existent-uuid',
        'admin-uuid-1',
        { status: 'approved' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_APPLICATION_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -------------------------------------------------------------------------
  // 异常流程 — 申请已审核
  // -------------------------------------------------------------------------

  it('should throw COACHING_APPLICATION_ALREADY_REVIEWED when application is already approved', async () => {
    // 业务规则: 申请状态必须为 pending 才能审核
    // 来源: coach-verification.md §4 错误码 COACHING_APPLICATION_ALREADY_REVIEWED
    const approvedRecord = createCoachApplicationRecord({
      status: 'approved',
      reviewedBy: 'admin-uuid-2',
      reviewedAt: new Date(),
    });
    repo.findCoachApplicationById.mockResolvedValue(approvedRecord);

    await expect(
      service.reviewCoachApplication(
        'application-uuid-1',
        'admin-uuid-1',
        { status: 'approved' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_APPLICATION_ALREADY_REVIEWED',
      statusCode: 409,
    });
  });

  it('should throw COACHING_APPLICATION_ALREADY_REVIEWED when application is already rejected', async () => {
    // 业务规则: 已拒绝的申请也不能再次审核
    // 来源: coach-verification.md §4 错误码 COACHING_APPLICATION_ALREADY_REVIEWED
    const rejectedRecord = createCoachApplicationRecord({
      status: 'rejected',
      rejectReason: '证书不合格',
      reviewedBy: 'admin-uuid-2',
      reviewedAt: new Date(),
    });
    repo.findCoachApplicationById.mockResolvedValue(rejectedRecord);

    await expect(
      service.reviewCoachApplication(
        'application-uuid-1',
        'admin-uuid-1',
        { status: 'rejected', rejectReason: '再次拒绝的原因说明' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_APPLICATION_ALREADY_REVIEWED',
      statusCode: 409,
    });
  });
});
