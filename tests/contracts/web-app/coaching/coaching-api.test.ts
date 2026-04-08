/**
 * 契约测试: web-app/coaching — API 调用层（coaching + review）
 * 覆盖接口:
 *   - GET    /api/coaches                          (教练列表)
 *   - GET    /api/coaches/:id                      (教练主页)
 *   - PUT    /api/coaches/me                       (更新教练资料)
 *   - POST   /api/group-classes                    (发布团课)
 *   - GET    /api/group-classes/:id                (团课详情)
 *   - PUT    /api/group-classes/:id                (修改团课)
 *   - POST   /api/group-classes/:id/cancel         (取消团课)
 *   - POST   /api/group-classes/:id/enroll         (报名团课)
 *   - POST   /api/group-classes/:id/cancel-enrollment (取消团课报名)
 *   - GET    /api/group-classes/:id/match-records  (团课战绩列表)
 *   - POST   /api/private-lessons/availability     (设置私教空闲时间)
 *   - GET    /api/coaches/:id/availability          (获取教练空闲时间)
 *   - POST   /api/private-lessons/book             (预约私教课)
 *   - POST   /api/private-lessons/:id/cancel       (取消私教预约)
 *   - GET    /api/users/:id/enrollments            (用户课程报名列表)
 *   - GET    /api/coaches/:id/private-lessons      (教练私教预约列表)
 *   - GET    /api/coaches/:id/rating               (教练评分)
 *   - POST   /api/coaches/ratings                  (批量教练评分)
 *   - GET    /api/coaches/:id/reviews              (教练评价列表)
 *   - POST   /api/reviews                          (提交评价)
 *   - DELETE /api/match-records/:id                (删除战绩)
 *
 * 来源文档:
 *   - docs/module-design/coaching.md §4 接口契约
 *   - docs/module-design/review.md §4 接口契约
 *   - docs/module-design/match-record.md §4 接口契约
 *   - docs/module-design/web-app-coaching.md §5 消费的后端接口汇总
 *
 * Mock 策略:
 *   - MSW (Mock Service Worker) 拦截 HTTP 请求
 *   - 验证请求 URL、HTTP 方法、请求体/查询参数格式
 *   - 验证成功响应和错误响应的解析
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  getCoaches,
  getCoachProfile,
  updateCoachProfile,
  createGroupClass,
  getGroupClassDetail,
  updateGroupClass,
  cancelGroupClass,
  enrollGroupClass,
  cancelEnrollment,
  setAvailability,
  getCoachAvailability,
  bookPrivateLesson,
  cancelPrivateLesson,
  getUserEnrollments,
  getCoachPrivateLessons,
} from '@web/features/coaching/api/coaching-api';
import {
  getCoachRating,
  getCoachesRatings,
  getCoachReviews,
  createReview,
} from '@web/features/coaching/api/review-api';
import { deleteMatchRecord } from '@web/features/match-record/api/match-record-api';

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
  name: '朝阳体育中心羽毛球馆',
  address: '北京市朝阳区...',
  latitude: 39.9215,
  longitude: 116.4435,
};

const mockSlotVenue = {
  id: 'venue-uuid-1',
  name: '朝阳体育中心羽毛球馆',
  address: '北京市朝阳区...',
};

const mockCoachListItem = {
  userId: 'coach-uuid-1',
  nickname: '教练张',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: '10年教学经验',
  specialties: ['singles', 'footwork'],
  studentCount: 42,
};

const mockCoachProfile = {
  userId: 'coach-uuid-1',
  nickname: '教练张',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: '10年教学经验',
  specialties: ['singles', 'footwork'],
  studentCount: 42,
  groupClasses: [
    {
      id: 'gc-uuid-1',
      title: '初级单打提升班',
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      venue: mockSlotVenue,
      maxParticipants: 10,
      currentParticipants: 5,
      feeDescription: '200元/人',
      status: 'open',
    },
  ],
  privateLessonSlots: [
    {
      id: 'slot-uuid-1',
      startTime: '2026-04-11T10:00:00.000Z',
      endTime: '2026-04-11T12:00:00.000Z',
      venues: [mockSlotVenue],
      feeDescription: '300元/小时',
      isBooked: false,
    },
  ],
};

const mockGroupClassDetail = {
  id: 'gc-uuid-1',
  coachId: 'coach-uuid-1',
  coach: { id: 'coach-uuid-1', nickname: '教练张', avatarUrl: null },
  title: '初级单打提升班',
  venue: mockVenue,
  startTime: '2026-04-10T14:00:00.000Z',
  endTime: '2026-04-10T16:00:00.000Z',
  maxParticipants: 10,
  currentParticipants: 5,
  feeDescription: '200元/人',
  status: 'open',
  enrollments: [
    {
      userId: 'user-uuid-1',
      nickname: '羽球达人',
      avatarUrl: null,
      enrolledAt: '2026-04-03T09:00:00.000Z',
    },
  ],
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockMatchRecord = {
  id: 'mr-uuid-1',
  sourceType: 'group-class',
  sourceId: 'gc-uuid-1',
  matchType: 'doubles',
  recordedBy: 'user-uuid-1',
  recorder: { id: 'user-uuid-1', nickname: '李四', avatarUrl: null },
  players: {
    sideA: [{ userId: 'user-uuid-1', nickname: '张三', avatarUrl: null }],
    sideB: [{ guestId: 'guest-uuid-1', nickname: '临时球友B' }],
  },
  games: [{ gameNumber: 1, scoreA: 21, scoreB: 19 }],
  result: 'A_WIN',
  createdAt: '2026-04-06T20:00:00.000Z',
};

const mockRating = {
  coachId: 'coach-uuid-1',
  averageRating: 4.5,
  totalCount: 15,
};

const mockReview = {
  id: 'review-uuid-1',
  reviewer: {
    id: 'user-uuid-1',
    nickname: '张三',
    avatarUrl: 'https://example.com/avatar.jpg',
  },
  courseType: 'group-class',
  courseId: 'gc-uuid-1',
  rating: 5,
  comment: '教练讲解很细致，推荐！',
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockPrivateLesson = {
  id: 'pl-uuid-1',
  slot: {
    startTime: '2026-04-11T10:00:00.000Z',
    endTime: '2026-04-11T12:00:00.000Z',
  },
  venue: mockSlotVenue,
  student: {
    id: 'user-uuid-1',
    nickname: '羽球达人',
    avatarUrl: 'https://example.com/avatar.jpg',
  },
  status: 'scheduled',
  createdAt: '2026-04-03T10:00:00.000Z',
};

const mockEnrollmentGroupClass = {
  type: 'group-class',
  groupClass: {
    id: 'gc-uuid-1',
    title: '初级单打提升班',
    coachId: 'coach-uuid-1',
    coachNickname: '教练张',
    venue: { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆' },
    startTime: '2026-04-10T14:00:00.000Z',
    endTime: '2026-04-10T16:00:00.000Z',
    status: 'open',
    enrolledAt: '2026-04-03T09:00:00.000Z',
  },
  privateLesson: null,
};

const mockEnrollmentPrivateLesson = {
  type: 'private-lesson',
  groupClass: null,
  privateLesson: {
    id: 'pl-uuid-1',
    coachId: 'coach-uuid-1',
    coachNickname: '教练张',
    venue: { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆' },
    startTime: '2026-04-11T10:00:00.000Z',
    endTime: '2026-04-11T12:00:00.000Z',
    status: 'scheduled',
    createdAt: '2026-04-03T10:00:00.000Z',
  },
};

// ===========================================================================
// GET /api/coaches — 教练列表
// ===========================================================================

describe('getCoaches API', () => {
  // 来源: coaching.md §4 — 教练列表 — Request (GET 方法、URL)
  it('should send GET request to /api/coaches', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getCoaches({});

    expect(capturedUrl).toContain('/api/coaches');
  });

  // 来源: coaching.md §4 — 教练列表 — Query Params (page, pageSize)
  it('should pass pagination params as query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 2, pageSize: 10 },
        });
      }),
    );

    await getCoaches({ page: 2, pageSize: 10 });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });

  // 来源: coaching.md §4 — 教练列表 — Query Params (specialty)
  it('should pass specialty filter as query parameter', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getCoaches({ specialty: 'singles' });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('specialty')).toBe('singles');
  });

  // 来源: coaching.md §4 — 教练列表 — Response 200 (数据结构)
  it('should parse successful response with coach list items', async () => {
    server.use(
      http.get('/api/coaches', () => {
        return HttpResponse.json({
          data: {
            items: [mockCoachListItem],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getCoaches({});

    expect(result).toEqual({
      items: [mockCoachListItem],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  // 来源: coaching.md §4 — 教练列表 — 错误码 COACHING_INVALID_SPECIALTY
  it('should throw error with code for invalid specialty', async () => {
    server.use(
      http.get('/api/coaches', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_SPECIALTY', message: 'specialty 值不在枚举范围内' } },
          { status: 400 },
        );
      }),
    );

    await expect(getCoaches({ specialty: 'invalid' })).rejects.toMatchObject({
      code: 'COACHING_INVALID_SPECIALTY',
    });
  });
});

// ===========================================================================
// GET /api/coaches/:id — 教练主页
// ===========================================================================

describe('getCoachProfile API', () => {
  // 来源: coaching.md §4 — 教练主页 — Request (GET 方法、URL)
  it('should send GET request to /api/coaches/:id', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches/:id', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: mockCoachProfile });
      }),
    );

    await getCoachProfile('coach-uuid-1');

    expect(capturedUrl).toContain('/api/coaches/coach-uuid-1');
  });

  // 来源: coaching.md §4 — 教练主页 — Response 200 (数据结构)
  it('should parse successful response with coach profile data', async () => {
    server.use(
      http.get('/api/coaches/:id', () => {
        return HttpResponse.json({ data: mockCoachProfile });
      }),
    );

    const result = await getCoachProfile('coach-uuid-1');

    expect(result).toEqual(mockCoachProfile);
    expect(result.groupClasses).toHaveLength(1);
    expect(result.privateLessonSlots).toHaveLength(1);
  });

  // 来源: coaching.md §4 — 教练主页 — 错误码 COACHING_NOT_A_COACH
  it('should throw error when coach not found (404)', async () => {
    server.use(
      http.get('/api/coaches/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_A_COACH', message: '用户不存在或不是教练角色' } },
          { status: 404 },
        );
      }),
    );

    await expect(getCoachProfile('non-existent')).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
    });
  });
});

// ===========================================================================
// PUT /api/coaches/me — 更新教练资料
// ===========================================================================

describe('updateCoachProfile API', () => {
  // 来源: coaching.md §4 — 更新教练资料 — Request Body
  it('should send PUT request to /api/coaches/me with coach profile data', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: unknown = null;

    server.use(
      http.put('/api/coaches/me', async ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            userId: 'user-uuid-1',
            bio: '10年教学经验',
            specialties: ['singles', 'footwork'],
            updatedAt: '2026-04-02T10:00:00.000Z',
          },
        });
      }),
    );

    await updateCoachProfile({ bio: '10年教学经验', specialties: ['singles', 'footwork'] });

    expect(capturedUrl).toBe('/api/coaches/me');
    expect(capturedMethod).toBe('PUT');
    expect(capturedBody).toEqual({ bio: '10年教学经验', specialties: ['singles', 'footwork'] });
  });

  // 来源: coaching.md §4 — 更新教练资料 — Response 200
  it('should return updated coach profile from successful response', async () => {
    server.use(
      http.put('/api/coaches/me', () => {
        return HttpResponse.json({
          data: {
            userId: 'user-uuid-1',
            bio: '10年教学经验',
            specialties: ['singles', 'footwork'],
            updatedAt: '2026-04-02T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await updateCoachProfile({ bio: '10年教学经验', specialties: ['singles', 'footwork'] });

    expect(result).toEqual({
      userId: 'user-uuid-1',
      bio: '10年教学经验',
      specialties: ['singles', 'footwork'],
      updatedAt: '2026-04-02T10:00:00.000Z',
    });
  });

  // 来源: coaching.md §4 — 更新教练资料 — 错误码 COACHING_INVALID_BIO
  it('should throw error with code COACHING_INVALID_BIO for bio exceeding limit', async () => {
    server.use(
      http.put('/api/coaches/me', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_BIO', message: '简介超过 500 字符' } },
          { status: 400 },
        );
      }),
    );

    await expect(updateCoachProfile({ bio: 'x'.repeat(501) })).rejects.toMatchObject({
      code: 'COACHING_INVALID_BIO',
    });
  });

  // 来源: coaching.md §4 — 更新教练资料 — 错误码 COACHING_INVALID_SPECIALTY
  it('should throw error with code COACHING_INVALID_SPECIALTY for invalid specialty', async () => {
    server.use(
      http.put('/api/coaches/me', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_SPECIALTY', message: 'specialties 中有值不在枚举范围内' } },
          { status: 400 },
        );
      }),
    );

    await expect(updateCoachProfile({ specialties: ['invalid-specialty'] })).rejects.toMatchObject({
      code: 'COACHING_INVALID_SPECIALTY',
    });
  });

  // 来源: coaching.md §4 — 更新教练资料 — 错误码 COACHING_COACH_ROLE_REQUIRED
  it('should throw error with code COACHING_COACH_ROLE_REQUIRED for non-coach user', async () => {
    server.use(
      http.put('/api/coaches/me', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_COACH_ROLE_REQUIRED', message: '当前用户不是教练角色' } },
          { status: 403 },
        );
      }),
    );

    await expect(updateCoachProfile({ bio: '简介' })).rejects.toMatchObject({
      code: 'COACHING_COACH_ROLE_REQUIRED',
    });
  });
});

// ===========================================================================
// POST /api/group-classes — 发布团课
// ===========================================================================

describe('createGroupClass API', () => {
  // 来源: coaching.md §4 — 发布团课 — Request (POST 方法、URL、Body)
  it('should send POST request to /api/group-classes with body', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/group-classes', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              id: 'gc-uuid-new',
              coachId: 'coach-uuid-1',
              title: '初级单打提升班',
              venue: mockVenue,
              startTime: '2026-04-10T14:00:00.000Z',
              endTime: '2026-04-10T16:00:00.000Z',
              maxParticipants: 10,
              currentParticipants: 0,
              feeDescription: '200元/人',
              status: 'open',
              createdAt: '2026-04-02T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    const data = {
      title: '初级单打提升班',
      venueId: 'venue-uuid-1',
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      maxParticipants: 10,
      feeDescription: '200元/人',
    };

    await createGroupClass(data);

    expect(capturedBody).toEqual(data);
  });

  // 来源: coaching.md §4 — 发布团课 — Response 201 (数据结构)
  it('should parse successful 201 response', async () => {
    const responseData = {
      id: 'gc-uuid-new',
      coachId: 'coach-uuid-1',
      title: '初级单打提升班',
      venue: mockVenue,
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      maxParticipants: 10,
      currentParticipants: 0,
      feeDescription: '200元/人',
      status: 'open',
      createdAt: '2026-04-02T10:00:00.000Z',
    };

    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json({ data: responseData }, { status: 201 });
      }),
    );

    const result = await createGroupClass({
      title: '初级单打提升班',
      venueId: 'venue-uuid-1',
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      maxParticipants: 10,
    });

    expect(result).toEqual(responseData);
  });

  // 来源: coaching.md §4 — 发布团课 — 错误码 COACHING_INVALID_TITLE
  it('should throw error for invalid title', async () => {
    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_TITLE', message: 'title 为空或超过 50 字符' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      createGroupClass({
        title: '',
        venueId: 'venue-uuid-1',
        startTime: '2026-04-10T14:00:00.000Z',
        endTime: '2026-04-10T16:00:00.000Z',
        maxParticipants: 10,
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_TITLE' });
  });

  // 来源: coaching.md §4 — 发布团课 — 错误码 COACHING_COACH_ROLE_REQUIRED
  it('should throw error when user is not a coach', async () => {
    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_COACH_ROLE_REQUIRED', message: '当前用户不是教练角色' } },
          { status: 403 },
        );
      }),
    );

    await expect(
      createGroupClass({
        title: '测试',
        venueId: 'venue-uuid-1',
        startTime: '2026-04-10T14:00:00.000Z',
        endTime: '2026-04-10T16:00:00.000Z',
        maxParticipants: 10,
      }),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_ROLE_REQUIRED' });
  });

  // 来源: coaching.md §4 — 发布团课 — 错误码 COACHING_VENUE_NOT_FOUND
  it('should throw error when venue not found', async () => {
    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_VENUE_NOT_FOUND', message: '球馆不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(
      createGroupClass({
        title: '测试',
        venueId: 'non-existent',
        startTime: '2026-04-10T14:00:00.000Z',
        endTime: '2026-04-10T16:00:00.000Z',
        maxParticipants: 10,
      }),
    ).rejects.toMatchObject({ code: 'COACHING_VENUE_NOT_FOUND' });
  });

  // 来源: coaching.md §4 — 发布团课 — 错误码 COACHING_INVALID_VENUE
  it('should throw error for invalid venue', async () => {
    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_VENUE', message: 'venueId 缺失或格式不合法' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      createGroupClass({
        title: '测试',
        venueId: '',
        startTime: '2026-04-10T14:00:00.000Z',
        endTime: '2026-04-10T16:00:00.000Z',
        maxParticipants: 10,
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_VENUE' });
  });

  // 来源: coaching.md §4 — 发布团课 — 错误码 COACHING_INVALID_TIME
  it('should throw error for invalid time', async () => {
    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_TIME', message: '开始时间不晚于当前时间，或结束时间不晚于开始时间' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      createGroupClass({
        title: '测试',
        venueId: 'venue-uuid-1',
        startTime: '2020-01-01T00:00:00.000Z',
        endTime: '2020-01-01T01:00:00.000Z',
        maxParticipants: 10,
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_TIME' });
  });

  // 来源: coaching.md §4 — 发布团课 — 错误码 COACHING_INVALID_PARTICIPANTS
  it('should throw error for invalid participants', async () => {
    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_PARTICIPANTS', message: 'maxParticipants 不在 2-30 范围内' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      createGroupClass({
        title: '测试',
        venueId: 'venue-uuid-1',
        startTime: '2026-04-10T14:00:00.000Z',
        endTime: '2026-04-10T16:00:00.000Z',
        maxParticipants: 50,
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_PARTICIPANTS' });
  });

  // 来源: coaching.md §4 — 发布团课 — 错误码 COACHING_INVALID_FEE_DESCRIPTION
  it('should throw error for invalid fee description', async () => {
    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_FEE_DESCRIPTION', message: 'feeDescription 超过 200 字符' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      createGroupClass({
        title: '测试',
        venueId: 'venue-uuid-1',
        startTime: '2026-04-10T14:00:00.000Z',
        endTime: '2026-04-10T16:00:00.000Z',
        maxParticipants: 10,
        feeDescription: 'x'.repeat(201),
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_FEE_DESCRIPTION' });
  });

  // 来源: coaching.md §4 — 发布团课 — 错误码 AUTH_UNAUTHORIZED
  it('should throw error when not authenticated', async () => {
    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' } },
          { status: 401 },
        );
      }),
    );

    await expect(
      createGroupClass({
        title: '测试',
        venueId: 'venue-uuid-1',
        startTime: '2026-04-10T14:00:00.000Z',
        endTime: '2026-04-10T16:00:00.000Z',
        maxParticipants: 10,
      }),
    ).rejects.toMatchObject({ code: 'AUTH_UNAUTHORIZED' });
  });

  // 来源: SF-1 — 发布团课成功响应关键字段独立断言
  it('should return response with status open and currentParticipants 0 for new group class', async () => {
    const responseData = {
      id: 'gc-uuid-new',
      coachId: 'coach-uuid-1',
      title: '初级单打提升班',
      venue: mockVenue,
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      maxParticipants: 10,
      currentParticipants: 0,
      feeDescription: '200元/人',
      status: 'open',
      createdAt: '2026-04-02T10:00:00.000Z',
    };

    server.use(
      http.post('/api/group-classes', () => {
        return HttpResponse.json({ data: responseData }, { status: 201 });
      }),
    );

    const result = await createGroupClass({
      title: '初级单打提升班',
      venueId: 'venue-uuid-1',
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      maxParticipants: 10,
    });

    expect(result.status).toBe('open');
    expect(result.currentParticipants).toBe(0);
    expect(result.id).toBeDefined();
    expect(result.coachId).toBeDefined();
  });
});

// ===========================================================================
// GET /api/group-classes/:id — 团课详情
// ===========================================================================

describe('getGroupClassDetail API', () => {
  // 来源: coaching.md §4 — 团课详情 — Request (GET 方法、URL)
  it('should send GET request to /api/group-classes/:id', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/group-classes/:id', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: mockGroupClassDetail });
      }),
    );

    await getGroupClassDetail('gc-uuid-1');

    expect(capturedUrl).toContain('/api/group-classes/gc-uuid-1');
  });

  // 来源: coaching.md §4 — 团课详情 — Response 200 (数据结构)
  it('should parse successful response with group class detail', async () => {
    server.use(
      http.get('/api/group-classes/:id', () => {
        return HttpResponse.json({ data: mockGroupClassDetail });
      }),
    );

    const result = await getGroupClassDetail('gc-uuid-1');

    expect(result).toEqual(mockGroupClassDetail);
    expect(result.coach).toBeDefined();
    expect(result.enrollments).toHaveLength(1);
  });

  // 来源: coaching.md §4 — 团课详情 — 错误码 COACHING_GROUP_CLASS_NOT_FOUND
  it('should throw error when group class not found', async () => {
    server.use(
      http.get('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_GROUP_CLASS_NOT_FOUND', message: '团课不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(getGroupClassDetail('non-existent')).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
    });
  });
});

// ===========================================================================
// PUT /api/group-classes/:id — 修改团课
// ===========================================================================

describe('updateGroupClass API', () => {
  // 来源: coaching.md §4 — 修改团课 — Request (PUT 方法、URL、Body)
  it('should send PUT request to /api/group-classes/:id with body', async () => {
    let capturedBody: unknown = null;
    let capturedUrl = '';

    server.use(
      http.put('/api/group-classes/:id', async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            id: 'gc-uuid-1',
            coachId: 'coach-uuid-1',
            title: '中级单打提升班',
            venue: mockVenue,
            startTime: '2026-04-10T15:00:00.000Z',
            endTime: '2026-04-10T17:00:00.000Z',
            maxParticipants: 12,
            currentParticipants: 5,
            feeDescription: '250元/人',
            status: 'open',
            createdAt: '2026-04-02T10:00:00.000Z',
          },
        });
      }),
    );

    const updateData = { title: '中级单打提升班', maxParticipants: 12 };
    await updateGroupClass('gc-uuid-1', updateData);

    expect(capturedUrl).toContain('/api/group-classes/gc-uuid-1');
    expect(capturedBody).toEqual(updateData);
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_NOT_COACH_OWNER
  it('should throw error when not the coach owner', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_COACH_OWNER', message: '无权修改此团课' } },
          { status: 403 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { title: '新标题' }),
    ).rejects.toMatchObject({ code: 'COACHING_NOT_COACH_OWNER' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_CLASS_NOT_MODIFIABLE
  it('should throw error when class is not modifiable', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_CLASS_NOT_MODIFIABLE', message: '团课状态不允许修改' } },
          { status: 409 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { title: '新标题' }),
    ).rejects.toMatchObject({ code: 'COACHING_CLASS_NOT_MODIFIABLE' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_PARTICIPANTS_EXCEED
  it('should throw error when maxParticipants less than current', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_PARTICIPANTS_EXCEED', message: '限定人数不能小于当前报名人数' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { maxParticipants: 1 }),
    ).rejects.toMatchObject({ code: 'COACHING_PARTICIPANTS_EXCEED' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_INVALID_TITLE
  it('should throw error for invalid title', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_TITLE', message: 'title 为空或超过 50 字符' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { title: '' }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_TITLE' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_INVALID_VENUE
  it('should throw error for invalid venue', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_VENUE', message: 'venueId 格式不合法' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { venueId: '' }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_VENUE' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_INVALID_TIME
  it('should throw error for invalid time', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_TIME', message: '开始时间不晚于当前时间，或结束时间不晚于开始时间' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { startTime: '2020-01-01T00:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_TIME' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_INVALID_PARTICIPANTS
  it('should throw error for invalid participants', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_PARTICIPANTS', message: 'maxParticipants 不在 2-30 范围内' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { maxParticipants: 50 }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_PARTICIPANTS' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_INVALID_FEE_DESCRIPTION
  it('should throw error for invalid fee description', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_FEE_DESCRIPTION', message: 'feeDescription 超过 200 字符' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { feeDescription: 'x'.repeat(201) }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_FEE_DESCRIPTION' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_GROUP_CLASS_NOT_FOUND
  it('should throw error when group class not found', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_GROUP_CLASS_NOT_FOUND', message: '团课不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(
      updateGroupClass('non-existent', { title: '新标题' }),
    ).rejects.toMatchObject({ code: 'COACHING_GROUP_CLASS_NOT_FOUND' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 COACHING_VENUE_NOT_FOUND
  it('should throw error when venue not found', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_VENUE_NOT_FOUND', message: '球馆不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { venueId: 'non-existent' }),
    ).rejects.toMatchObject({ code: 'COACHING_VENUE_NOT_FOUND' });
  });

  // 来源: coaching.md §4 — 修改团课 — 错误码 AUTH_UNAUTHORIZED
  it('should throw error when not authenticated', async () => {
    server.use(
      http.put('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' } },
          { status: 401 },
        );
      }),
    );

    await expect(
      updateGroupClass('gc-uuid-1', { title: '新标题' }),
    ).rejects.toMatchObject({ code: 'AUTH_UNAUTHORIZED' });
  });
});

// ===========================================================================
// POST /api/group-classes/:id/cancel — 取消团课
// ===========================================================================

describe('cancelGroupClass API', () => {
  // 来源: coaching.md §4 — 取消团课 — Request (POST 方法、URL)
  it('should send POST request to /api/group-classes/:id/cancel', async () => {
    let capturedUrl = '';

    server.use(
      http.post('/api/group-classes/:id/cancel', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { id: 'gc-uuid-1', status: 'cancelled' },
        });
      }),
    );

    await cancelGroupClass('gc-uuid-1');

    expect(capturedUrl).toContain('/api/group-classes/gc-uuid-1/cancel');
  });

  // 来源: coaching.md §4 — 取消团课 — Response 200 (数据结构)
  it('should parse successful cancel response', async () => {
    server.use(
      http.post('/api/group-classes/:id/cancel', () => {
        return HttpResponse.json({
          data: { id: 'gc-uuid-1', status: 'cancelled' },
        });
      }),
    );

    const result = await cancelGroupClass('gc-uuid-1');

    expect(result).toEqual({ id: 'gc-uuid-1', status: 'cancelled' });
  });

  // 来源: coaching.md §4 — 取消团课 — 错误码 COACHING_CLASS_NOT_CANCELLABLE
  it('should throw error when class is not cancellable', async () => {
    server.use(
      http.post('/api/group-classes/:id/cancel', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_CLASS_NOT_CANCELLABLE', message: '团课状态不允许取消' } },
          { status: 409 },
        );
      }),
    );

    await expect(cancelGroupClass('gc-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE',
    });
  });

  // 来源: coaching.md §4 — 取消团课 — 错误码 COACHING_NOT_COACH_OWNER
  it('should throw error when not the coach owner', async () => {
    server.use(
      http.post('/api/group-classes/:id/cancel', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_COACH_OWNER', message: '无权取消此团课' } },
          { status: 403 },
        );
      }),
    );

    await expect(cancelGroupClass('gc-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
    });
  });

  // 来源: coaching.md §4 — 取消团课 — 错误码 COACHING_GROUP_CLASS_NOT_FOUND
  it('should throw error when group class not found', async () => {
    server.use(
      http.post('/api/group-classes/:id/cancel', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_GROUP_CLASS_NOT_FOUND', message: '团课不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(cancelGroupClass('non-existent')).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
    });
  });
});

// ===========================================================================
// POST /api/group-classes/:id/enroll — 报名团课
// ===========================================================================

describe('enrollGroupClass API', () => {
  // 来源: coaching.md §4 — 报名团课 — Request (POST 方法、URL)
  it('should send POST request to /api/group-classes/:id/enroll', async () => {
    let capturedUrl = '';

    server.use(
      http.post('/api/group-classes/:id/enroll', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: {
            groupClassId: 'gc-uuid-1',
            userId: 'user-uuid-1',
            currentParticipants: 6,
            status: 'open',
            enrolledAt: '2026-04-03T09:00:00.000Z',
          },
        });
      }),
    );

    await enrollGroupClass('gc-uuid-1');

    expect(capturedUrl).toContain('/api/group-classes/gc-uuid-1/enroll');
  });

  // 来源: coaching.md §4 — 报名团课 — Response 200 (数据结构)
  it('should parse successful enroll response', async () => {
    const responseData = {
      groupClassId: 'gc-uuid-1',
      userId: 'user-uuid-1',
      currentParticipants: 6,
      status: 'open',
      enrolledAt: '2026-04-03T09:00:00.000Z',
    };

    server.use(
      http.post('/api/group-classes/:id/enroll', () => {
        return HttpResponse.json({ data: responseData });
      }),
    );

    const result = await enrollGroupClass('gc-uuid-1');

    expect(result).toEqual(responseData);
  });

  // 来源: coaching.md §4 — 报名团课 — 错误码 COACHING_CLASS_FULL
  it('should throw error when class is full', async () => {
    server.use(
      http.post('/api/group-classes/:id/enroll', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_CLASS_FULL', message: '团课已满员' } },
          { status: 409 },
        );
      }),
    );

    await expect(enrollGroupClass('gc-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_CLASS_FULL',
    });
  });

  // 来源: coaching.md §4 — 报名团课 — 错误码 COACHING_ALREADY_ENROLLED
  it('should throw error when already enrolled', async () => {
    server.use(
      http.post('/api/group-classes/:id/enroll', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_ALREADY_ENROLLED', message: '学员已报名该团课' } },
          { status: 409 },
        );
      }),
    );

    await expect(enrollGroupClass('gc-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_ALREADY_ENROLLED',
    });
  });

  // 来源: coaching.md §4 — 报名团课 — 错误码 COACHING_CANNOT_ENROLL_OWN_CLASS
  it('should throw error when coach tries to enroll own class', async () => {
    server.use(
      http.post('/api/group-classes/:id/enroll', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_CANNOT_ENROLL_OWN_CLASS', message: '教练不可报名自己的团课' } },
          { status: 403 },
        );
      }),
    );

    await expect(enrollGroupClass('gc-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_CANNOT_ENROLL_OWN_CLASS',
    });
  });

  // 来源: coaching.md §4 — 报名团课 — 错误码 COACHING_CLASS_NOT_ENROLLABLE
  it('should throw error when class is not enrollable', async () => {
    server.use(
      http.post('/api/group-classes/:id/enroll', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_CLASS_NOT_ENROLLABLE', message: '团课状态不允许报名' } },
          { status: 409 },
        );
      }),
    );

    await expect(enrollGroupClass('gc-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_ENROLLABLE',
    });
  });

  // 来源: coaching.md §4 — 报名团课 — 错误码 COACHING_GROUP_CLASS_NOT_FOUND
  it('should throw error when group class not found', async () => {
    server.use(
      http.post('/api/group-classes/:id/enroll', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_GROUP_CLASS_NOT_FOUND', message: '团课不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(enrollGroupClass('non-existent')).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
    });
  });
});

// ===========================================================================
// POST /api/group-classes/:id/cancel-enrollment — 取消团课报名
// ===========================================================================

describe('cancelEnrollment API', () => {
  // 来源: coaching.md §4 — 取消团课报名 — Request (POST 方法、URL)
  it('should send POST request to /api/group-classes/:id/cancel-enrollment', async () => {
    let capturedUrl = '';

    server.use(
      http.post('/api/group-classes/:id/cancel-enrollment', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: {
            groupClassId: 'gc-uuid-1',
            userId: 'user-uuid-1',
            currentParticipants: 5,
            status: 'open',
          },
        });
      }),
    );

    await cancelEnrollment('gc-uuid-1');

    expect(capturedUrl).toContain('/api/group-classes/gc-uuid-1/cancel-enrollment');
  });

  // 来源: coaching.md §4 — 取消团课报名 — Response 200 (数据结构)
  it('should parse successful cancel enrollment response', async () => {
    const responseData = {
      groupClassId: 'gc-uuid-1',
      userId: 'user-uuid-1',
      currentParticipants: 5,
      status: 'open',
    };

    server.use(
      http.post('/api/group-classes/:id/cancel-enrollment', () => {
        return HttpResponse.json({ data: responseData });
      }),
    );

    const result = await cancelEnrollment('gc-uuid-1');

    expect(result).toEqual(responseData);
  });

  // 来源: coaching.md §4 — 取消团课报名 — 错误码 COACHING_NOT_ENROLLED
  it('should throw error when not enrolled', async () => {
    server.use(
      http.post('/api/group-classes/:id/cancel-enrollment', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_ENROLLED', message: '学员未报名该团课' } },
          { status: 409 },
        );
      }),
    );

    await expect(cancelEnrollment('gc-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_NOT_ENROLLED',
    });
  });

  // 来源: coaching.md §4 — 取消团课报名 — 错误码 COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT
  it('should throw error when enrollment cancellation not allowed', async () => {
    server.use(
      http.post('/api/group-classes/:id/cancel-enrollment', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
              message: '团课状态不允许取消报名',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(cancelEnrollment('gc-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
    });
  });

  // 来源: coaching.md §4 — 取消团课报名 — 错误码 COACHING_GROUP_CLASS_NOT_FOUND
  it('should throw error when group class not found', async () => {
    server.use(
      http.post('/api/group-classes/:id/cancel-enrollment', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_GROUP_CLASS_NOT_FOUND', message: '团课不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(cancelEnrollment('non-existent')).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
    });
  });
});

// ===========================================================================
// POST /api/private-lessons/availability — 设置私教空闲时间
// ===========================================================================

describe('setAvailability API', () => {
  // 来源: coaching.md §4 — 设置私教空闲时间 — Request (POST 方法、URL、Body)
  it('should send POST request to /api/private-lessons/availability with slots array', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/private-lessons/availability', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              slots: [
                {
                  id: 'slot-uuid-new',
                  coachId: 'coach-uuid-1',
                  startTime: '2026-04-11T10:00:00.000Z',
                  endTime: '2026-04-11T12:00:00.000Z',
                  venueIds: ['venue-uuid-1'],
                  feeDescription: '300元/小时',
                  isBooked: false,
                  createdAt: '2026-04-02T10:00:00.000Z',
                },
              ],
            },
          },
          { status: 201 },
        );
      }),
    );

    const data = {
      slots: [
        {
          startTime: '2026-04-11T10:00:00.000Z',
          endTime: '2026-04-11T12:00:00.000Z',
          venueIds: ['venue-uuid-1'],
          feeDescription: '300元/小时',
        },
      ],
    };

    await setAvailability(data);

    expect(capturedBody).toEqual(data);
  });

  // 来源: coaching.md §4 — 设置私教空闲时间 — 错误码 COACHING_INVALID_SLOTS
  it('should throw error for empty slots array', async () => {
    server.use(
      http.post('/api/private-lessons/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_SLOTS', message: 'slots 为空数组或非数组' } },
          { status: 400 },
        );
      }),
    );

    await expect(setAvailability({ slots: [] })).rejects.toMatchObject({
      code: 'COACHING_INVALID_SLOTS',
    });
  });

  // 来源: coaching.md §4 — 设置私教空闲时间 — 错误码 COACHING_SLOT_OVERLAP
  it('should throw error for overlapping slots', async () => {
    server.use(
      http.post('/api/private-lessons/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_SLOT_OVERLAP', message: '时间段与已有时间段重叠' } },
          { status: 409 },
        );
      }),
    );

    await expect(
      setAvailability({
        slots: [
          {
            startTime: '2026-04-11T10:00:00.000Z',
            endTime: '2026-04-11T12:00:00.000Z',
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'COACHING_SLOT_OVERLAP' });
  });

  // 来源: coaching.md §4 — 设置私教空闲时间 — 错误码 COACHING_SLOT_TOO_SHORT
  it('should throw error for slot too short', async () => {
    server.use(
      http.post('/api/private-lessons/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_SLOT_TOO_SHORT', message: '时间段至少为 1 小时' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      setAvailability({
        slots: [
          {
            startTime: '2026-04-11T10:00:00.000Z',
            endTime: '2026-04-11T10:30:00.000Z',
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'COACHING_SLOT_TOO_SHORT' });
  });

  // 来源: coaching.md §4 — 设置私教空闲时间 — 错误码 COACHING_INVALID_SLOT_TIME
  it('should throw error for invalid slot time', async () => {
    server.use(
      http.post('/api/private-lessons/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_SLOT_TIME', message: '时间段开始时间不晚于当前时间，或结束时间不晚于开始时间' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      setAvailability({
        slots: [
          {
            startTime: '2020-01-01T10:00:00.000Z',
            endTime: '2020-01-01T12:00:00.000Z',
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_SLOT_TIME' });
  });

  // 来源: coaching.md §4 — 设置私教空闲时间 — 错误码 COACHING_INVALID_FEE_DESCRIPTION
  it('should throw error for invalid fee description', async () => {
    server.use(
      http.post('/api/private-lessons/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_FEE_DESCRIPTION', message: 'feeDescription 超过 200 字符' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      setAvailability({
        slots: [
          {
            startTime: '2026-04-11T10:00:00.000Z',
            endTime: '2026-04-11T12:00:00.000Z',
            feeDescription: 'x'.repeat(201),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_FEE_DESCRIPTION' });
  });

  // 来源: coaching.md §4 — 设置私教空闲时间 — 错误码 COACHING_COACH_ROLE_REQUIRED
  it('should throw error when user is not a coach', async () => {
    server.use(
      http.post('/api/private-lessons/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_COACH_ROLE_REQUIRED', message: '当前用户不是教练角色，无权执行此操作' } },
          { status: 403 },
        );
      }),
    );

    await expect(
      setAvailability({
        slots: [
          {
            startTime: '2026-04-11T10:00:00.000Z',
            endTime: '2026-04-11T12:00:00.000Z',
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_ROLE_REQUIRED' });
  });

  // 来源: coaching.md §4 — 设置私教空闲时间 — 错误码 COACHING_VENUE_NOT_FOUND
  it('should throw error when venue not found', async () => {
    server.use(
      http.post('/api/private-lessons/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_VENUE_NOT_FOUND', message: 'venueIds 中有球馆不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(
      setAvailability({
        slots: [
          {
            startTime: '2026-04-11T10:00:00.000Z',
            endTime: '2026-04-11T12:00:00.000Z',
            venueIds: ['non-existent'],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'COACHING_VENUE_NOT_FOUND' });
  });
});

// ===========================================================================
// GET /api/coaches/:id/availability — 获取教练空闲时间
// ===========================================================================

describe('getCoachAvailability API', () => {
  // 来源: coaching.md §4 — 获取教练空闲时间 — Request (GET 方法、URL)
  it('should send GET request to /api/coaches/:id/availability', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches/:id/availability', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { slots: [] },
        });
      }),
    );

    await getCoachAvailability('coach-uuid-1');

    expect(capturedUrl).toContain('/api/coaches/coach-uuid-1/availability');
  });

  // 来源: coaching.md §4 — 获取教练空闲时间 — Query Params (startDate, endDate)
  it('should pass startDate and endDate as query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches/:id/availability', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: { slots: [] } });
      }),
    );

    await getCoachAvailability('coach-uuid-1', {
      startDate: '2026-04-11',
      endDate: '2026-04-25',
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('startDate')).toBe('2026-04-11');
    expect(url.searchParams.get('endDate')).toBe('2026-04-25');
  });

  // 来源: coaching.md §4 — 获取教练空闲时间 — Response 200 (数据结构)
  it('should parse successful response with slots', async () => {
    const mockSlot = {
      id: 'slot-uuid-1',
      startTime: '2026-04-11T10:00:00.000Z',
      endTime: '2026-04-11T12:00:00.000Z',
      venues: [mockSlotVenue],
      feeDescription: '300元/小时',
      isBooked: false,
    };

    server.use(
      http.get('/api/coaches/:id/availability', () => {
        return HttpResponse.json({ data: { slots: [mockSlot] } });
      }),
    );

    const result = await getCoachAvailability('coach-uuid-1');

    expect(result).toEqual({ slots: [mockSlot] });
  });

  // 来源: coaching.md §4 — 获取教练空闲时间 — 错误码 COACHING_NOT_A_COACH
  it('should throw error when coach not found', async () => {
    server.use(
      http.get('/api/coaches/:id/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_A_COACH', message: '用户不存在或不是教练角色' } },
          { status: 404 },
        );
      }),
    );

    await expect(getCoachAvailability('non-existent')).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
    });
  });
});

// ===========================================================================
// POST /api/private-lessons/book — 预约私教课
// ===========================================================================

describe('bookPrivateLesson API', () => {
  // 来源: coaching.md §4 — 预约私教课 — Request (POST 方法、URL、Body)
  it('should send POST request to /api/private-lessons/book with body', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/private-lessons/book', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              id: 'pl-uuid-new',
              slotId: 'slot-uuid-1',
              coachId: 'coach-uuid-1',
              studentId: 'user-uuid-1',
              venue: mockSlotVenue,
              startTime: '2026-04-11T10:00:00.000Z',
              endTime: '2026-04-11T12:00:00.000Z',
              status: 'scheduled',
              createdAt: '2026-04-02T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    await bookPrivateLesson({ slotId: 'slot-uuid-1', venueId: 'venue-uuid-1' });

    expect(capturedBody).toEqual({ slotId: 'slot-uuid-1', venueId: 'venue-uuid-1' });
  });

  // 来源: coaching.md §4 — 预约私教课 — Request Body (venueId 可选)
  it('should allow booking without venueId when slot has no venues', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/private-lessons/book', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              id: 'pl-uuid-new',
              slotId: 'slot-uuid-2',
              coachId: 'coach-uuid-1',
              studentId: 'user-uuid-1',
              venue: null,
              startTime: '2026-04-11T10:00:00.000Z',
              endTime: '2026-04-11T12:00:00.000Z',
              status: 'scheduled',
              createdAt: '2026-04-02T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    await bookPrivateLesson({ slotId: 'slot-uuid-2' });

    expect(capturedBody).toEqual({ slotId: 'slot-uuid-2' });
  });

  // 来源: coaching.md §4 — 预约私教课 — 错误码 COACHING_SLOT_ALREADY_BOOKED
  it('should throw error when slot is already booked', async () => {
    server.use(
      http.post('/api/private-lessons/book', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_SLOT_ALREADY_BOOKED', message: '该时间段已被预约' } },
          { status: 409 },
        );
      }),
    );

    await expect(
      bookPrivateLesson({ slotId: 'slot-uuid-1' }),
    ).rejects.toMatchObject({ code: 'COACHING_SLOT_ALREADY_BOOKED' });
  });

  // 来源: coaching.md §4 — 预约私教课 — 错误码 COACHING_SLOT_EXPIRED
  it('should throw error when slot is expired', async () => {
    server.use(
      http.post('/api/private-lessons/book', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_SLOT_EXPIRED', message: '该时间段已过期' } },
          { status: 409 },
        );
      }),
    );

    await expect(
      bookPrivateLesson({ slotId: 'slot-uuid-1' }),
    ).rejects.toMatchObject({ code: 'COACHING_SLOT_EXPIRED' });
  });

  // 来源: coaching.md §4 — 预约私教课 — 错误码 COACHING_VENUE_REQUIRED
  it('should throw error when venue is required but not provided', async () => {
    server.use(
      http.post('/api/private-lessons/book', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_VENUE_REQUIRED', message: '请选择上课地点' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      bookPrivateLesson({ slotId: 'slot-uuid-1' }),
    ).rejects.toMatchObject({ code: 'COACHING_VENUE_REQUIRED' });
  });

  // 来源: coaching.md §4 — 预约私教课 — 错误码 COACHING_CANNOT_BOOK_OWN_LESSON
  it('should throw error when coach books own lesson', async () => {
    server.use(
      http.post('/api/private-lessons/book', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_CANNOT_BOOK_OWN_LESSON', message: '不能预约自己的私教课' } },
          { status: 403 },
        );
      }),
    );

    await expect(
      bookPrivateLesson({ slotId: 'slot-uuid-1' }),
    ).rejects.toMatchObject({ code: 'COACHING_CANNOT_BOOK_OWN_LESSON' });
  });

  // 来源: coaching.md §4 — 预约私教课 — 错误码 COACHING_INVALID_VENUE_CHOICE
  it('should throw error for invalid venue choice', async () => {
    server.use(
      http.post('/api/private-lessons/book', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_VENUE_CHOICE', message: '选择的球馆不在可选范围内' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      bookPrivateLesson({ slotId: 'slot-uuid-1', venueId: 'invalid-venue' }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_VENUE_CHOICE' });
  });

  // 来源: coaching.md §4 — 预约私教课 — 错误码 COACHING_INVALID_SLOT
  it('should throw error for invalid slot', async () => {
    server.use(
      http.post('/api/private-lessons/book', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_INVALID_SLOT', message: 'slotId 缺失或格式不合法' } },
          { status: 400 },
        );
      }),
    );

    await expect(
      bookPrivateLesson({ slotId: '' }),
    ).rejects.toMatchObject({ code: 'COACHING_INVALID_SLOT' });
  });

  // 来源: coaching.md §4 — 预约私教课 — 错误码 COACHING_SLOT_NOT_FOUND
  it('should throw error when slot not found', async () => {
    server.use(
      http.post('/api/private-lessons/book', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_SLOT_NOT_FOUND', message: '时间段不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(
      bookPrivateLesson({ slotId: 'non-existent' }),
    ).rejects.toMatchObject({ code: 'COACHING_SLOT_NOT_FOUND' });
  });

  // 来源: coaching.md §4 — 预约私教课 — 错误码 COACHING_VENUE_NOT_FOUND
  it('should throw error when venue not found', async () => {
    server.use(
      http.post('/api/private-lessons/book', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_VENUE_NOT_FOUND', message: '球馆不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(
      bookPrivateLesson({ slotId: 'slot-uuid-1', venueId: 'non-existent' }),
    ).rejects.toMatchObject({ code: 'COACHING_VENUE_NOT_FOUND' });
  });
});

// ===========================================================================
// POST /api/private-lessons/:id/cancel — 取消私教预约
// ===========================================================================

describe('cancelPrivateLesson API', () => {
  // 来源: coaching.md §4 — 取消私教预约 — Request (POST 方法、URL)
  it('should send POST request to /api/private-lessons/:id/cancel', async () => {
    let capturedUrl = '';

    server.use(
      http.post('/api/private-lessons/:id/cancel', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { id: 'pl-uuid-1', status: 'cancelled' },
        });
      }),
    );

    await cancelPrivateLesson('pl-uuid-1');

    expect(capturedUrl).toContain('/api/private-lessons/pl-uuid-1/cancel');
  });

  // 来源: coaching.md §4 — 取消私教预约 — Response 200 (数据结构)
  it('should parse successful cancel response', async () => {
    server.use(
      http.post('/api/private-lessons/:id/cancel', () => {
        return HttpResponse.json({
          data: { id: 'pl-uuid-1', status: 'cancelled' },
        });
      }),
    );

    const result = await cancelPrivateLesson('pl-uuid-1');

    expect(result).toEqual({ id: 'pl-uuid-1', status: 'cancelled' });
  });

  // 来源: coaching.md §4 — 取消私教预约 — 错误码 COACHING_LESSON_NOT_CANCELLABLE
  it('should throw error when lesson is not cancellable', async () => {
    server.use(
      http.post('/api/private-lessons/:id/cancel', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_LESSON_NOT_CANCELLABLE', message: '私教课状态不允许取消' } },
          { status: 409 },
        );
      }),
    );

    await expect(cancelPrivateLesson('pl-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
    });
  });

  // 来源: coaching.md §4 — 取消私教预约 — 错误码 COACHING_NOT_LESSON_PARTICIPANT
  it('should throw error when not a participant', async () => {
    server.use(
      http.post('/api/private-lessons/:id/cancel', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_LESSON_PARTICIPANT', message: '无权取消此私教课' } },
          { status: 403 },
        );
      }),
    );

    await expect(cancelPrivateLesson('pl-uuid-1')).rejects.toMatchObject({
      code: 'COACHING_NOT_LESSON_PARTICIPANT',
    });
  });

  // 来源: coaching.md §4 — 取消私教预约 — 错误码 COACHING_PRIVATE_LESSON_NOT_FOUND
  it('should throw error when private lesson not found', async () => {
    server.use(
      http.post('/api/private-lessons/:id/cancel', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_PRIVATE_LESSON_NOT_FOUND', message: '私教课不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(cancelPrivateLesson('non-existent')).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_LESSON_NOT_FOUND',
    });
  });
});

// ===========================================================================
// GET /api/users/:id/enrollments — 用户课程报名列表
// ===========================================================================

describe('getUserEnrollments API', () => {
  // 来源: coaching.md §4 — 用户课程报名列表 — Request (GET 方法、URL)
  it('should send GET request to /api/users/:id/enrollments', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/enrollments', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getUserEnrollments('user-uuid-1', {});

    expect(capturedUrl).toContain('/api/users/user-uuid-1/enrollments');
  });

  // 来源: coaching.md §4 — 用户课程报名列表 — Query Params (page, pageSize, type, status)
  it('should pass filter params as query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/enrollments', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 10 },
        });
      }),
    );

    await getUserEnrollments('user-uuid-1', {
      page: 1,
      pageSize: 10,
      type: 'group-class',
      status: 'completed',
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('10');
    expect(url.searchParams.get('type')).toBe('group-class');
    expect(url.searchParams.get('status')).toBe('completed');
  });

  // 来源: coaching.md §4 — 用户课程报名列表 — Response 200 (数据结构 — 团课)
  it('should parse response with group class enrollment items', async () => {
    server.use(
      http.get('/api/users/:id/enrollments', () => {
        return HttpResponse.json({
          data: {
            items: [mockEnrollmentGroupClass],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getUserEnrollments('user-uuid-1', {});

    expect(result.items[0].type).toBe('group-class');
    expect(result.items[0].groupClass).toBeDefined();
    expect(result.items[0].privateLesson).toBeNull();
  });

  // 来源: coaching.md §4 — 用户课程报名列表 — Response 200 (数据结构 — 私教)
  it('should parse response with private lesson enrollment items', async () => {
    server.use(
      http.get('/api/users/:id/enrollments', () => {
        return HttpResponse.json({
          data: {
            items: [mockEnrollmentPrivateLesson],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getUserEnrollments('user-uuid-1', {});

    expect(result.items[0].type).toBe('private-lesson');
    expect(result.items[0].privateLesson).toBeDefined();
    expect(result.items[0].groupClass).toBeNull();
  });
});

// ===========================================================================
// GET /api/coaches/:id/private-lessons — 教练私教预约列表
// ===========================================================================

describe('getCoachPrivateLessons API', () => {
  // 来源: coaching.md §4 — 教练私教预约列表 — Request (GET 方法、URL)
  it('should send GET request to /api/coaches/:id/private-lessons', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches/:id/private-lessons', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getCoachPrivateLessons('coach-uuid-1', {});

    expect(capturedUrl).toContain('/api/coaches/coach-uuid-1/private-lessons');
  });

  // 来源: coaching.md §4 — 教练私教预约列表 — Query Params (status, page, pageSize)
  it('should pass status filter as query parameter', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches/:id/private-lessons', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getCoachPrivateLessons('coach-uuid-1', { status: 'scheduled', page: 1, pageSize: 10 });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('status')).toBe('scheduled');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });

  // 来源: coaching.md §4 — 教练私教预约列表 — Response 200 (数据结构)
  it('should parse successful response with private lesson items', async () => {
    server.use(
      http.get('/api/coaches/:id/private-lessons', () => {
        return HttpResponse.json({
          data: {
            items: [mockPrivateLesson],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getCoachPrivateLessons('coach-uuid-1', {});

    expect(result.items[0]).toEqual(mockPrivateLesson);
    expect(result.items[0].student).toBeDefined();
    expect(result.items[0].slot).toBeDefined();
  });

  // 来源: coaching.md §4 — 教练私教预约列表 — 错误码 COACHING_NOT_A_COACH
  it('should throw error when user is not a coach', async () => {
    server.use(
      http.get('/api/coaches/:id/private-lessons', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_A_COACH', message: '用户不存在或不是教练角色' } },
          { status: 403 },
        );
      }),
    );

    await expect(getCoachPrivateLessons('non-coach-id', {})).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
    });
  });
});

// ===========================================================================
// GET /api/coaches/:id/rating — 教练评分查询
// ===========================================================================

describe('getCoachRating API', () => {
  // 来源: review.md §4 — 教练评分查询 — Request (GET 方法、URL)
  it('should send GET request to /api/coaches/:id/rating', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches/:id/rating', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: mockRating });
      }),
    );

    await getCoachRating('coach-uuid-1');

    expect(capturedUrl).toContain('/api/coaches/coach-uuid-1/rating');
  });

  // 来源: review.md §4 — 教练评分查询 — Response 200 (有评价)
  it('should parse successful response with rating data', async () => {
    server.use(
      http.get('/api/coaches/:id/rating', () => {
        return HttpResponse.json({ data: mockRating });
      }),
    );

    const result = await getCoachRating('coach-uuid-1');

    expect(result).toEqual(mockRating);
    expect(result.averageRating).toBe(4.5);
    expect(result.totalCount).toBe(15);
  });

  // 来源: review.md §4 — 教练评分查询 — Response 200 (无评价)
  it('should parse response with null rating when no reviews', async () => {
    server.use(
      http.get('/api/coaches/:id/rating', () => {
        return HttpResponse.json({
          data: { coachId: 'coach-uuid-1', averageRating: null, totalCount: 0 },
        });
      }),
    );

    const result = await getCoachRating('coach-uuid-1');

    expect(result.averageRating).toBeNull();
    expect(result.totalCount).toBe(0);
  });
});

// ===========================================================================
// POST /api/coaches/ratings — 批量教练评分查询
// ===========================================================================

describe('getCoachesRatings API', () => {
  // 来源: review.md §4 — 批量教练评分查询 — Request (POST 方法、URL、Body)
  it('should send POST request to /api/coaches/ratings with coachIds', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/coaches/ratings', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: { ratings: [mockRating] },
        });
      }),
    );

    await getCoachesRatings(['coach-uuid-1']);

    expect(capturedBody).toEqual({ coachIds: ['coach-uuid-1'] });
  });

  // 来源: review.md §4 — 批量教练评分查询 — Response 200 (数据结构)
  it('should parse successful response with multiple ratings', async () => {
    const ratings = [
      mockRating,
      { coachId: 'coach-uuid-2', averageRating: null, totalCount: 0 },
    ];

    server.use(
      http.post('/api/coaches/ratings', () => {
        return HttpResponse.json({ data: { ratings } });
      }),
    );

    const result = await getCoachesRatings(['coach-uuid-1', 'coach-uuid-2']);

    expect(result).toEqual({ ratings });
    expect(result.ratings).toHaveLength(2);
  });

  // 来源: review.md §4 — 批量教练评分查询 — 错误码 REVIEW_INVALID_COACH_IDS
  it('should throw error for invalid coachIds', async () => {
    server.use(
      http.post('/api/coaches/ratings', () => {
        return HttpResponse.json(
          { error: { code: 'REVIEW_INVALID_COACH_IDS', message: 'coachIds 缺失或非数组' } },
          { status: 400 },
        );
      }),
    );

    await expect(getCoachesRatings([])).rejects.toMatchObject({
      code: 'REVIEW_INVALID_COACH_IDS',
    });
  });
});

// ===========================================================================
// GET /api/coaches/:id/reviews — 教练评价列表
// ===========================================================================

describe('getCoachReviews API', () => {
  // 来源: review.md §4 — 教练评价列表 — Request (GET 方法、URL)
  it('should send GET request to /api/coaches/:id/reviews', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches/:id/reviews', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getCoachReviews('coach-uuid-1', {});

    expect(capturedUrl).toContain('/api/coaches/coach-uuid-1/reviews');
  });

  // 来源: review.md §4 — 教练评价列表 — Query Params (page, pageSize)
  it('should pass pagination params as query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/coaches/:id/reviews', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 2, pageSize: 10 },
        });
      }),
    );

    await getCoachReviews('coach-uuid-1', { page: 2, pageSize: 10 });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });

  // 来源: review.md §4 — 教练评价列表 — Response 200 (数据结构)
  it('should parse successful response with review items', async () => {
    server.use(
      http.get('/api/coaches/:id/reviews', () => {
        return HttpResponse.json({
          data: {
            items: [mockReview],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getCoachReviews('coach-uuid-1', {});

    expect(result.items[0]).toEqual(mockReview);
    expect(result.items[0].reviewer).toBeDefined();
    expect(result.items[0].rating).toBe(5);
  });
});

// ===========================================================================
// POST /api/reviews — 提交评价
// ===========================================================================

describe('createReview API', () => {
  // 来源: review.md §4 — 提交评价 — Request (POST 方法、URL、Body)
  it('should send POST request to /api/reviews with body', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/reviews', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              id: 'review-uuid-new',
              reviewerId: 'user-uuid-1',
              coachId: 'coach-uuid-1',
              courseType: 'group-class',
              courseId: 'gc-uuid-1',
              rating: 5,
              comment: '很好',
              createdAt: '2026-04-02T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    const data = {
      coachId: 'coach-uuid-1',
      courseType: 'group-class',
      courseId: 'gc-uuid-1',
      rating: 5,
      comment: '很好',
    };

    await createReview(data);

    expect(capturedBody).toEqual(data);
  });

  // 来源: review.md §4 — 提交评价 — Request Body (comment 可选)
  it('should allow review without comment', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/reviews', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              id: 'review-uuid-new',
              reviewerId: 'user-uuid-1',
              coachId: 'coach-uuid-1',
              courseType: 'group-class',
              courseId: 'gc-uuid-1',
              rating: 4,
              comment: null,
              createdAt: '2026-04-02T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    await createReview({
      coachId: 'coach-uuid-1',
      courseType: 'group-class',
      courseId: 'gc-uuid-1',
      rating: 4,
    });

    // comment should not be in the body if not provided
    expect(capturedBody).not.toHaveProperty('comment');
  });

  // 来源: review.md §4 — 提交评价 — 错误码 REVIEW_DUPLICATE
  it('should throw error for duplicate review', async () => {
    server.use(
      http.post('/api/reviews', () => {
        return HttpResponse.json(
          { error: { code: 'REVIEW_DUPLICATE', message: '同一学员对同一次课程已评价过' } },
          { status: 409 },
        );
      }),
    );

    await expect(
      createReview({
        coachId: 'coach-uuid-1',
        courseType: 'group-class',
        courseId: 'gc-uuid-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_DUPLICATE' });
  });

  // 来源: review.md §4 — 提交评价 — 错误码 REVIEW_COURSE_NOT_COMPLETED
  it('should throw error when course is not completed', async () => {
    server.use(
      http.post('/api/reviews', () => {
        return HttpResponse.json(
          { error: { code: 'REVIEW_COURSE_NOT_COMPLETED', message: '课程尚未结束' } },
          { status: 409 },
        );
      }),
    );

    await expect(
      createReview({
        coachId: 'coach-uuid-1',
        courseType: 'group-class',
        courseId: 'gc-uuid-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_COURSE_NOT_COMPLETED' });
  });

  // 来源: review.md §4 — 提交评价 — 错误码 REVIEW_NOT_PARTICIPANT
  it('should throw error when not a participant', async () => {
    server.use(
      http.post('/api/reviews', () => {
        return HttpResponse.json(
          { error: { code: 'REVIEW_NOT_PARTICIPANT', message: '仅参加过该课程的学员可以评价' } },
          { status: 403 },
        );
      }),
    );

    await expect(
      createReview({
        coachId: 'coach-uuid-1',
        courseType: 'group-class',
        courseId: 'gc-uuid-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_NOT_PARTICIPANT' });
  });

  // 来源: review.md §4 — 提交评价 — 错误码 REVIEW_CANNOT_REVIEW_SELF
  it('should throw error when reviewing self', async () => {
    server.use(
      http.post('/api/reviews', () => {
        return HttpResponse.json(
          { error: { code: 'REVIEW_CANNOT_REVIEW_SELF', message: '不能评价自己' } },
          { status: 403 },
        );
      }),
    );

    await expect(
      createReview({
        coachId: 'coach-uuid-1',
        courseType: 'group-class',
        courseId: 'gc-uuid-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_CANNOT_REVIEW_SELF' });
  });

  // 来源: review.md §4 — 提交评价 — 错误码 REVIEW_COURSE_COACH_MISMATCH
  it('should throw error for course-coach mismatch', async () => {
    server.use(
      http.post('/api/reviews', () => {
        return HttpResponse.json(
          { error: { code: 'REVIEW_COURSE_COACH_MISMATCH', message: '课程与教练不匹配' } },
          { status: 409 },
        );
      }),
    );

    await expect(
      createReview({
        coachId: 'coach-uuid-1',
        courseType: 'group-class',
        courseId: 'gc-uuid-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_COURSE_COACH_MISMATCH' });
  });

  // 来源: review.md §4 — 提交评价 — 错误码 REVIEW_COACH_NOT_FOUND
  it('should throw error when coach not found', async () => {
    server.use(
      http.post('/api/reviews', () => {
        return HttpResponse.json(
          { error: { code: 'REVIEW_COACH_NOT_FOUND', message: 'coachId 对应的用户不存在或不是教练角色' } },
          { status: 404 },
        );
      }),
    );

    await expect(
      createReview({
        coachId: 'non-existent',
        courseType: 'group-class',
        courseId: 'gc-uuid-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_COACH_NOT_FOUND' });
  });

  // 来源: review.md §4 — 提交评价 — 错误码 REVIEW_COURSE_NOT_FOUND
  it('should throw error when course not found', async () => {
    server.use(
      http.post('/api/reviews', () => {
        return HttpResponse.json(
          { error: { code: 'REVIEW_COURSE_NOT_FOUND', message: '课程不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(
      createReview({
        coachId: 'coach-uuid-1',
        courseType: 'group-class',
        courseId: 'non-existent',
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_COURSE_NOT_FOUND' });
  });
});

// ===========================================================================
// DELETE /api/match-records/:id — 删除战绩
// ===========================================================================

describe('deleteMatchRecord API (consumed by GroupClassDetailPage)', () => {
  // 来源: match-record.md §4 — 删除战绩 — Request (DELETE 方法、URL)
  it('should send DELETE request to /api/match-records/:id', async () => {
    let capturedUrl = '';

    server.use(
      http.delete('/api/match-records/:id', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: { id: 'mr-uuid-1' } });
      }),
    );

    await deleteMatchRecord('mr-uuid-1');

    expect(capturedUrl).toContain('/api/match-records/mr-uuid-1');
  });

  // 来源: match-record.md §4 — 删除战绩 — 错误码 MATCH_RECORD_NOT_FOUND
  it('should throw error when match record not found', async () => {
    server.use(
      http.delete('/api/match-records/:id', () => {
        return HttpResponse.json(
          { error: { code: 'MATCH_RECORD_NOT_FOUND', message: '战绩不存在' } },
          { status: 404 },
        );
      }),
    );

    await expect(deleteMatchRecord('non-existent')).rejects.toMatchObject({
      code: 'MATCH_RECORD_NOT_FOUND',
    });
  });
});

// ===========================================================================
// GET /api/group-classes/:id/match-records — 团课战绩列表
// ===========================================================================

describe('getGroupClassMatchRecords (via getSourceMatchRecords)', () => {
  // 来源: match-record.md §4 — 团课战绩列表 — Request (GET 方法、URL)
  // Note: The coaching feature accesses this via match-record API's getSourceMatchRecords
  it('should send GET request to /api/group-classes/:id/match-records', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/group-classes/:id/match-records', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [mockMatchRecord] },
        });
      }),
    );

    // This tests the URL pattern that the coaching page will consume
    const { getSourceMatchRecords } = await import(
      '@web/features/match-record/api/match-record-api'
    );
    await getSourceMatchRecords('group-class', 'gc-uuid-1', {});

    expect(capturedUrl).toContain('/api/group-classes/gc-uuid-1/match-records');
  });

  // 来源: match-record.md §4 — 团课战绩列表 — Response 200 (数据结构)
  it('should parse response with match record items', async () => {
    server.use(
      http.get('/api/group-classes/:id/match-records', () => {
        return HttpResponse.json({
          data: { items: [mockMatchRecord] },
        });
      }),
    );

    const { getSourceMatchRecords } = await import(
      '@web/features/match-record/api/match-record-api'
    );
    const result = await getSourceMatchRecords('group-class', 'gc-uuid-1', {});

    expect(result.items[0]).toEqual(mockMatchRecord);
    expect(result.items[0].players.sideA).toHaveLength(1);
    expect(result.items[0].games).toHaveLength(1);
  });
});
