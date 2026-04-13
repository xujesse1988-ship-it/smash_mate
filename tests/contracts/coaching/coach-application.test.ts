/**
 * 契约测试: coaching 模块 — 教练申请接口
 * 覆盖接口:
 *   - POST /api/coach-applications (CoachingService.submitCoachApplication)
 *   - GET /api/coach-applications/me (CoachingService.getMyApplicationStatus)
 *
 * 来源文档: docs/module-design/coach-verification.md §4 接口契约 + §6 关键业务逻辑
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
// POST /api/coach-applications — submitCoachApplication
// ===========================================================================

describe('POST /api/coach-applications — CoachingService.submitCoachApplication', () => {
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

  it('should create a coach application with valid certificateUrls and description', async () => {
    // 业务规则: certificateUrls 1-5 张 + description 选填 → 创建成功，status = pending
    // 来源: coach-verification.md §4 POST /api/coach-applications - Response 201
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    const result = await service.submitCoachApplication('user-uuid-1', {
      certificateUrls: ['https://example.com/cert1.jpg'],
      description: '国家二级运动员',
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      userId: 'user-uuid-1',
      certificateUrls: ['https://example.com/cert1.jpg'],
      description: '国家二级运动员',
      status: 'pending',
    });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('should accept application with multiple certificate URLs (up to 5)', async () => {
    // 业务规则: certificateUrls 至少 1 个，最多 5 个
    // 来源: coach-verification.md §4 POST 接口业务规则 bullet 1
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    const urls = [
      'https://example.com/cert1.jpg',
      'https://example.com/cert2.png',
      'https://example.com/cert3.jpeg',
      'https://example.com/cert4.jpg',
      'https://example.com/cert5.png',
    ];

    const expectedRecord = createCoachApplicationRecord({
      certificateUrls: urls,
    });
    repo.createCoachApplication.mockResolvedValue(expectedRecord);

    const result = await service.submitCoachApplication('user-uuid-1', {
      certificateUrls: urls,
    });

    expect(result.certificateUrls).toHaveLength(5);
  });

  it('should accept application without description (optional)', async () => {
    // 业务规则: description 选填
    // 来源: coach-verification.md §4 POST 接口 Request Body — description 不是必填
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    const expectedRecord = createCoachApplicationRecord({
      description: null,
    });
    repo.createCoachApplication.mockResolvedValue(expectedRecord);

    const result = await service.submitCoachApplication('user-uuid-1', {
      certificateUrls: ['https://example.com/cert1.jpg'],
    });

    expect(result.status).toBe('pending');
  });

  it('should allow resubmission after rejection (creates new record)', async () => {
    // 业务规则: 被拒绝后可重新提交（创建新的 CoachApplication 记录）
    // 来源: coach-verification.md §6.1 状态机 + §4 POST 接口业务规则 bullet 7
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    // User's latest application was rejected
    repo.findLatestApplicationByUser.mockResolvedValue(
      createCoachApplicationRecord({ status: 'rejected' }),
    );

    const newRecord = createCoachApplicationRecord({
      id: 'application-uuid-2',
      status: 'pending',
    });
    repo.createCoachApplication.mockResolvedValue(newRecord);

    const result = await service.submitCoachApplication('user-uuid-1', {
      certificateUrls: ['https://example.com/new-cert.jpg'],
    });

    expect(result.status).toBe('pending');
    expect(repo.createCoachApplication).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 异常流程 — 证书校验
  // -------------------------------------------------------------------------

  it('should reject empty certificateUrls', async () => {
    // 业务规则: certificateUrls 至少 1 个
    // 来源: coach-verification.md §4 错误码 COACHING_INVALID_CERTIFICATES
    await expect(
      service.submitCoachApplication('user-uuid-1', {
        certificateUrls: [],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CERTIFICATES',
      statusCode: 400,
    });
  });

  it('should reject more than 5 certificateUrls', async () => {
    // 业务规则: certificateUrls 最多 5 个
    // 来源: coach-verification.md §4 错误码 COACHING_INVALID_CERTIFICATES
    const urls = [
      'https://example.com/cert1.jpg',
      'https://example.com/cert2.jpg',
      'https://example.com/cert3.jpg',
      'https://example.com/cert4.jpg',
      'https://example.com/cert5.jpg',
      'https://example.com/cert6.jpg',
    ];

    await expect(
      service.submitCoachApplication('user-uuid-1', {
        certificateUrls: urls,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CERTIFICATES',
      statusCode: 400,
    });
  });

  it('should reject invalid URL format (not starting with http/https)', async () => {
    // 业务规则: 每个 URL 必须以 http:// 或 https:// 开头
    // 来源: coach-verification.md §4 错误码 COACHING_INVALID_CERTIFICATE_URL
    await expect(
      service.submitCoachApplication('user-uuid-1', {
        certificateUrls: ['ftp://example.com/cert.jpg'],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CERTIFICATE_URL',
      statusCode: 400,
    });
  });

  it('should reject URL without valid image extension', async () => {
    // 业务规则: URL 扩展名必须为 .jpg/.jpeg/.png（服务端格式校验）
    // 来源: coach-verification.md §4 错误码 COACHING_INVALID_CERTIFICATE_FORMAT
    await expect(
      service.submitCoachApplication('user-uuid-1', {
        certificateUrls: ['https://example.com/cert.gif'],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CERTIFICATE_FORMAT',
      statusCode: 400,
    });
  });

  it('should reject URL with .bmp extension', async () => {
    // 业务规则: 仅支持 JPG/PNG 格式
    // 来源: coach-verification.md §4 错误码 COACHING_INVALID_CERTIFICATE_FORMAT
    await expect(
      service.submitCoachApplication('user-uuid-1', {
        certificateUrls: ['https://example.com/cert.bmp'],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CERTIFICATE_FORMAT',
      statusCode: 400,
    });
  });

  // -------------------------------------------------------------------------
  // 异常流程 — 描述校验
  // -------------------------------------------------------------------------

  it('should reject description longer than 200 characters', async () => {
    // 业务规则: description 最多 200 字符
    // 来源: coach-verification.md §4 错误码 COACHING_INVALID_DESCRIPTION
    const longDescription = 'a'.repeat(201);

    await expect(
      service.submitCoachApplication('user-uuid-1', {
        certificateUrls: ['https://example.com/cert.jpg'],
        description: longDescription,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_DESCRIPTION',
      statusCode: 400,
    });
  });

  it('should accept description with exactly 200 characters', async () => {
    // 业务规则: description 最多 200 字符（边界值）
    // 来源: coach-verification.md §4 POST 接口业务规则
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    const description = 'a'.repeat(200);
    const expectedRecord = createCoachApplicationRecord({ description });
    repo.createCoachApplication.mockResolvedValue(expectedRecord);

    const result = await service.submitCoachApplication('user-uuid-1', {
      certificateUrls: ['https://example.com/cert.jpg'],
      description,
    });

    expect(result.description).toBe(description);
  });

  // -------------------------------------------------------------------------
  // 异常流程 — 业务状态冲突
  // -------------------------------------------------------------------------

  it('should reject if user already has a pending application', async () => {
    // 业务规则: 用户当前有 pending 状态的申请不可重复提交
    // 来源: coach-verification.md §4 错误码 COACHING_APPLICATION_PENDING
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友张三',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    repo.findLatestApplicationByUser.mockResolvedValue(
      createCoachApplicationRecord({ status: 'pending' }),
    );

    await expect(
      service.submitCoachApplication('user-uuid-1', {
        certificateUrls: ['https://example.com/cert.jpg'],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_APPLICATION_PENDING',
      statusCode: 409,
    });
  });

  it('should reject if user is already a coach', async () => {
    // 业务规则: 用户已是教练（isCoach = true）不可提交申请
    // 来源: coach-verification.md §4 错误码 COACHING_ALREADY_COACH
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '教练张',
      avatarUrl: null,
      bio: null,
      isCoach: true,
    });

    await expect(
      service.submitCoachApplication('user-uuid-1', {
        certificateUrls: ['https://example.com/cert.jpg'],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_ALREADY_COACH',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// GET /api/coach-applications/me — getMyApplicationStatus
// ===========================================================================

describe('GET /api/coach-applications/me — CoachingService.getMyApplicationStatus', () => {
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

  it('should return the latest application for the user', async () => {
    // 业务规则: 返回用户最新的一条 CoachApplication 记录
    // 来源: coach-verification.md §4 GET /api/coach-applications/me - Response 200
    const applicationRecord = createCoachApplicationRecord();
    repo.findLatestApplicationByUser.mockResolvedValue(applicationRecord);

    const result = await service.getMyApplicationStatus('user-uuid-1');

    expect(result).toMatchObject({
      id: 'application-uuid-1',
      status: 'pending',
      certificateUrls: ['https://example.com/cert1.jpg'],
      description: '国家二级运动员',
      rejectReason: null,
    });
    expect(result!.createdAt).toBeInstanceOf(Date);
    expect(result!.updatedAt).toBeInstanceOf(Date);
  });

  it('should return null when user has no applications', async () => {
    // 业务规则: 未提交过申请时返回 null
    // 来源: coach-verification.md §4 GET /api/coach-applications/me — "未提交过申请时返回 { data: null }"
    repo.findLatestApplicationByUser.mockResolvedValue(null);

    const result = await service.getMyApplicationStatus('user-uuid-1');

    expect(result).toBeNull();
  });

  it('should return rejected application with rejectReason', async () => {
    // 业务规则: 被拒绝时包含 rejectReason
    // 来源: coach-verification.md §4 GET /api/coach-applications/me - Response 200
    const rejectedRecord = createCoachApplicationRecord({
      status: 'rejected',
      rejectReason: '证书图片不清晰，请重新上传',
    });
    repo.findLatestApplicationByUser.mockResolvedValue(rejectedRecord);

    const result = await service.getMyApplicationStatus('user-uuid-1');

    expect(result).toMatchObject({
      status: 'rejected',
      rejectReason: '证书图片不清晰，请重新上传',
    });
  });

  it('should return approved application', async () => {
    // 业务规则: 已通过的申请返回 status = approved
    // 来源: coach-verification.md §4 GET /api/coach-applications/me - Response 200
    const approvedRecord = createCoachApplicationRecord({
      status: 'approved',
      reviewedBy: 'admin-uuid-1',
      reviewedAt: new Date('2026-04-13T11:00:00.000Z'),
    });
    repo.findLatestApplicationByUser.mockResolvedValue(approvedRecord);

    const result = await service.getMyApplicationStatus('user-uuid-1');

    expect(result).toMatchObject({
      status: 'approved',
    });
  });

  it('should call repository with correct userId', async () => {
    // 验证 Service 正确传递 userId 给 Repository
    repo.findLatestApplicationByUser.mockResolvedValue(null);

    await service.getMyApplicationStatus('user-uuid-1');

    expect(repo.findLatestApplicationByUser).toHaveBeenCalledWith(
      'user-uuid-1',
    );
  });
});
