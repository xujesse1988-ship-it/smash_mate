/**
 * 契约测试: web-app/activity — API 调用层
 * 覆盖接口:
 *   - GET    /api/activities          (活动列表)
 *   - GET    /api/activities/:id      (活动详情)
 *   - POST   /api/activities          (创建活动)
 *   - POST   /api/activities/:id/join (加入活动)
 *   - POST   /api/activities/:id/leave(退出活动)
 *   - PUT    /api/activities/:id      (修改活动)
 *   - POST   /api/activities/:id/cancel(取消活动)
 *   - GET    /api/users/:id/activities(用户活动列表)
 *
 * 来源文档:
 *   - docs/module-design/activity.md §4 接口契约
 *   - docs/module-design/web-app-activity.md §5 消费的后端接口汇总
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
  getActivities,
  getActivityDetail,
  createActivity,
  joinActivity,
  leaveActivity,
  updateActivity,
  cancelActivity,
  getUserActivities,
} from '@web/features/activity/api/activity-api';

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

const mockActivityListItem = {
  id: 'activity-uuid-1',
  creatorId: 'user-uuid-1',
  venue: mockVenue,
  title: null,
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T16:00:00.000Z',
  maxParticipants: 8,
  currentParticipants: 3,
  status: 'open',
  distance: 1.2,
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockParticipant = {
  userId: 'user-uuid-1',
  nickname: '球友38291',
  avatarUrl: null,
  joinedAt: '2026-04-02T10:00:00.000Z',
};

const mockActivityDetail = {
  id: 'activity-uuid-1',
  creatorId: 'user-uuid-1',
  creator: {
    id: 'user-uuid-1',
    nickname: '球友38291',
    avatarUrl: null,
  },
  venue: mockVenue,
  title: null,
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T16:00:00.000Z',
  maxParticipants: 8,
  currentParticipants: 3,
  status: 'open',
  participants: [mockParticipant],
  createdAt: '2026-04-02T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// GET /api/activities — 活动列表
// ---------------------------------------------------------------------------

describe('getActivities API', () => {
  // 来源: activity.md §4 — 活动列表 — Request (GET 方法、URL)
  it('should send GET request to /api/activities', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getActivities({});

    expect(capturedUrl).toContain('/api/activities');
  });

  // 来源: activity.md §4 — 活动列表 — Query Params (page, pageSize)
  it('should pass pagination params as query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 2, pageSize: 10 },
        });
      }),
    );

    await getActivities({ page: 2, pageSize: 10 });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });

  // 来源: activity.md §4 — 活动列表 — Query Params (dateFilter)
  it('should pass dateFilter as query parameter', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getActivities({ dateFilter: 'today' });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('dateFilter')).toBe('today');
  });

  // 来源: activity.md §4 — 活动列表 — Query Params (dateStart, dateEnd)
  it('should pass dateStart and dateEnd as query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getActivities({
      dateStart: '2026-04-05T00:00:00.000Z',
      dateEnd: '2026-04-06T23:59:59.000Z',
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('dateStart')).toBe('2026-04-05T00:00:00.000Z');
    expect(url.searchParams.get('dateEnd')).toBe('2026-04-06T23:59:59.000Z');
  });

  // 来源: activity.md §4 — 活动列表 — Query Params (maxDistance, latitude, longitude)
  it('should pass distance filter params as query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getActivities({
      maxDistance: 5,
      latitude: 39.9215,
      longitude: 116.4435,
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('maxDistance')).toBe('5');
    expect(url.searchParams.get('latitude')).toBe('39.9215');
    expect(url.searchParams.get('longitude')).toBe('116.4435');
  });

  // 来源: activity.md §4 — 活动列表 — Query Params (hasSlot)
  it('should pass hasSlot as query parameter', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getActivities({ hasSlot: true });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('hasSlot')).toBe('true');
  });

  // 来源: activity.md §4 — 活动列表 — Query Params (sortBy)
  it('should pass sortBy as query parameter', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getActivities({ sortBy: 'distance' });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('sortBy')).toBe('distance');
  });

  // 来源: activity.md §4 — 活动列表 — Response 200
  it('should return paginated activity list from successful response', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json({
          data: {
            items: [mockActivityListItem],
            total: 50,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getActivities({});

    expect(result).toEqual({
      items: [mockActivityListItem],
      total: 50,
      page: 1,
      pageSize: 20,
    });
  });

  // 来源: activity.md §4 — 活动列表 — Response 200 — distance 字段
  it('should include distance field when coordinates are provided', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json({
          data: {
            items: [{ ...mockActivityListItem, distance: 2.5 }],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getActivities({
      latitude: 39.9215,
      longitude: 116.4435,
    });

    expect(result.items[0].distance).toBe(2.5);
  });

  // 来源: activity.md §4 — 活动列表 — 错误码 ACTIVITY_INVALID_COORDINATES
  it('should throw error with code ACTIVITY_INVALID_COORDINATES', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_COORDINATES',
              message: '经纬度参数不合法',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      getActivities({ latitude: 39.9215 }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_COORDINATES',
    });
  });

  // 来源: activity.md §4 — 活动列表 — 错误码 ACTIVITY_INVALID_DATE_RANGE
  it('should throw error with code ACTIVITY_INVALID_DATE_RANGE', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_DATE_RANGE',
              message: '日期范围参数不合法',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      getActivities({ dateStart: '2026-04-05T00:00:00.000Z' }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_DATE_RANGE',
    });
  });

  // 来源: activity.md §4 — 通用 — 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED for unauthenticated request', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: '未认证' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(getActivities({})).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  // 来源: activity.md §4 — 活动列表 — 不传可选参数时不附加到 URL
  it('should not include undefined params in query string', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getActivities({});

    const url = new URL(capturedUrl);
    expect(url.searchParams.has('dateFilter')).toBe(false);
    expect(url.searchParams.has('maxDistance')).toBe(false);
    expect(url.searchParams.has('hasSlot')).toBe(false);
    expect(url.searchParams.has('sortBy')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/activities/:id — 活动详情
// ---------------------------------------------------------------------------

describe('getActivityDetail API', () => {
  // 来源: activity.md §4 — 活动详情 — Request (GET 方法、URL 含 id)
  it('should send GET request to /api/activities/:id', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities/:id', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: mockActivityDetail });
      }),
    );

    await getActivityDetail('activity-uuid-1');

    expect(capturedUrl).toContain('/api/activities/activity-uuid-1');
  });

  // 来源: activity.md §4 — 活动详情 — Response 200
  it('should return activity detail with participants from successful response', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({ data: mockActivityDetail });
      }),
    );

    const result = await getActivityDetail('activity-uuid-1');

    expect(result).toEqual(mockActivityDetail);
    expect(result.creator).toEqual({
      id: 'user-uuid-1',
      nickname: '球友38291',
      avatarUrl: null,
    });
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].userId).toBe('user-uuid-1');
  });

  // 来源: activity.md §4 — 活动详情 — venue 为 null 场景
  it('should handle null venue in activity detail', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: { ...mockActivityDetail, venue: null },
        });
      }),
    );

    const result = await getActivityDetail('activity-uuid-1');

    expect(result.venue).toBeNull();
  });

  // 来源: activity.md §4 — 活动详情 — 错误码 ACTIVITY_NOT_FOUND
  it('should throw error with code ACTIVITY_NOT_FOUND for non-existent activity', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_FOUND',
              message: '活动不存在',
            },
          },
          { status: 404 },
        );
      }),
    );

    await expect(
      getActivityDetail('non-existent-id'),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
    });
  });

  // 来源: activity.md §4 — 活动详情 — 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: '未认证' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(
      getActivityDetail('activity-uuid-1'),
    ).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/activities — 创建活动
// ---------------------------------------------------------------------------

describe('createActivity API', () => {
  // 来源: activity.md §4 — 创建活动 — Request Body
  it('should send POST request to /api/activities with correct body', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/activities', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              ...mockActivityDetail,
              currentParticipants: 1,
              participants: [mockParticipant],
            },
          },
          { status: 201 },
        );
      }),
    );

    await createActivity({
      venueId: 'venue-uuid-1',
      title: '周末约球',
      startTime: '2026-04-05T14:00:00.000Z',
      endTime: '2026-04-05T16:00:00.000Z',
      maxParticipants: 8,
    });

    expect(capturedBody).toEqual({
      venueId: 'venue-uuid-1',
      title: '周末约球',
      startTime: '2026-04-05T14:00:00.000Z',
      endTime: '2026-04-05T16:00:00.000Z',
      maxParticipants: 8,
    });
  });

  // 来源: activity.md §4 — 创建活动 — Request Body — title 为可选
  it('should not include title when not provided', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/activities', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              ...mockActivityDetail,
              currentParticipants: 1,
              participants: [mockParticipant],
            },
          },
          { status: 201 },
        );
      }),
    );

    await createActivity({
      venueId: 'venue-uuid-1',
      startTime: '2026-04-05T14:00:00.000Z',
      endTime: '2026-04-05T16:00:00.000Z',
      maxParticipants: 8,
    });

    expect(capturedBody).not.toHaveProperty('title');
  });

  // 来源: activity.md §4 — 创建活动 — Response 201
  it('should return created activity from successful response', async () => {
    const createdActivity = {
      id: 'new-activity-uuid',
      creatorId: 'user-uuid-1',
      venue: mockVenue,
      title: null,
      startTime: '2026-04-05T14:00:00.000Z',
      endTime: '2026-04-05T16:00:00.000Z',
      maxParticipants: 8,
      currentParticipants: 1,
      status: 'open',
      participants: [mockParticipant],
      createdAt: '2026-04-02T10:00:00.000Z',
    };

    server.use(
      http.post('/api/activities', () => {
        return HttpResponse.json({ data: createdActivity }, { status: 201 });
      }),
    );

    const result = await createActivity({
      venueId: 'venue-uuid-1',
      startTime: '2026-04-05T14:00:00.000Z',
      endTime: '2026-04-05T16:00:00.000Z',
      maxParticipants: 8,
    });

    expect(result.id).toBe('new-activity-uuid');
    expect(result.status).toBe('open');
    expect(result.currentParticipants).toBe(1);
    expect(result.participants).toHaveLength(1);
  });

  // 来源: activity.md §4 — 创建活动 — 错误码 ACTIVITY_INVALID_VENUE
  it('should throw error with code ACTIVITY_INVALID_VENUE', async () => {
    server.use(
      http.post('/api/activities', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_VENUE',
              message: 'venueId 缺失或格式不合法',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      createActivity({
        venueId: '',
        startTime: '2026-04-05T14:00:00.000Z',
        endTime: '2026-04-05T16:00:00.000Z',
        maxParticipants: 8,
      }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_VENUE',
    });
  });

  // 来源: activity.md §4 — 创建活动 — 错误码 ACTIVITY_INVALID_TIME
  it('should throw error with code ACTIVITY_INVALID_TIME', async () => {
    server.use(
      http.post('/api/activities', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_TIME',
              message: '时间参数不合法',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      createActivity({
        venueId: 'venue-uuid-1',
        startTime: '2020-01-01T00:00:00.000Z',
        endTime: '2020-01-01T02:00:00.000Z',
        maxParticipants: 8,
      }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TIME',
    });
  });

  // 来源: activity.md §4 — 创建活动 — 错误码 ACTIVITY_INVALID_PARTICIPANTS
  it('should throw error with code ACTIVITY_INVALID_PARTICIPANTS', async () => {
    server.use(
      http.post('/api/activities', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_PARTICIPANTS',
              message: 'maxParticipants 不在 2-50 范围内',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      createActivity({
        venueId: 'venue-uuid-1',
        startTime: '2026-04-05T14:00:00.000Z',
        endTime: '2026-04-05T16:00:00.000Z',
        maxParticipants: 1,
      }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_PARTICIPANTS',
    });
  });

  // 来源: activity.md §4 — 创建活动 — 错误码 ACTIVITY_INVALID_TITLE
  it('should throw error with code ACTIVITY_INVALID_TITLE', async () => {
    server.use(
      http.post('/api/activities', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_TITLE',
              message: 'title 超过 50 字符',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      createActivity({
        venueId: 'venue-uuid-1',
        title: 'a'.repeat(51),
        startTime: '2026-04-05T14:00:00.000Z',
        endTime: '2026-04-05T16:00:00.000Z',
        maxParticipants: 8,
      }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TITLE',
    });
  });

  // 来源: activity.md §4 — 创建活动 — 错误码 ACTIVITY_VENUE_NOT_FOUND
  it('should throw error with code ACTIVITY_VENUE_NOT_FOUND', async () => {
    server.use(
      http.post('/api/activities', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_VENUE_NOT_FOUND',
              message: '球馆不存在',
            },
          },
          { status: 404 },
        );
      }),
    );

    await expect(
      createActivity({
        venueId: 'non-existent-venue',
        startTime: '2026-04-05T14:00:00.000Z',
        endTime: '2026-04-05T16:00:00.000Z',
        maxParticipants: 8,
      }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_VENUE_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/activities/:id/join — 加入活动
// ---------------------------------------------------------------------------

describe('joinActivity API', () => {
  // 来源: activity.md §4 — 加入活动 — Request (POST 方法、URL、无 Body)
  it('should send POST request to /api/activities/:id/join', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.post('/api/activities/:id/join', ({ request }) => {
        capturedUrl = request.url;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            activityId: 'activity-uuid-1',
            userId: 'user-uuid-2',
            currentParticipants: 4,
            status: 'open',
            joinedAt: '2026-04-02T12:00:00.000Z',
          },
        });
      }),
    );

    await joinActivity('activity-uuid-1');

    expect(capturedUrl).toContain('/api/activities/activity-uuid-1/join');
    expect(capturedMethod).toBe('POST');
  });

  // 来源: activity.md §4 — 加入活动 — Response 200
  it('should return join result from successful response', async () => {
    server.use(
      http.post('/api/activities/:id/join', () => {
        return HttpResponse.json({
          data: {
            activityId: 'activity-uuid-1',
            userId: 'user-uuid-2',
            currentParticipants: 4,
            status: 'open',
            joinedAt: '2026-04-02T12:00:00.000Z',
          },
        });
      }),
    );

    const result = await joinActivity('activity-uuid-1');

    expect(result).toEqual({
      activityId: 'activity-uuid-1',
      userId: 'user-uuid-2',
      currentParticipants: 4,
      status: 'open',
      joinedAt: '2026-04-02T12:00:00.000Z',
    });
  });

  // 来源: activity.md §4 — 加入活动 — Response 200 — status 变为 full
  it('should return full status when activity becomes full after join', async () => {
    server.use(
      http.post('/api/activities/:id/join', () => {
        return HttpResponse.json({
          data: {
            activityId: 'activity-uuid-1',
            userId: 'user-uuid-2',
            currentParticipants: 8,
            status: 'full',
            joinedAt: '2026-04-02T12:00:00.000Z',
          },
        });
      }),
    );

    const result = await joinActivity('activity-uuid-1');

    expect(result.status).toBe('full');
    expect(result.currentParticipants).toBe(8);
  });

  // 来源: activity.md §4 — 加入活动 — 错误码 ACTIVITY_NOT_FOUND
  it('should throw error with code ACTIVITY_NOT_FOUND', async () => {
    server.use(
      http.post('/api/activities/:id/join', () => {
        return HttpResponse.json(
          {
            error: { code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' },
          },
          { status: 404 },
        );
      }),
    );

    await expect(joinActivity('non-existent')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
    });
  });

  // 来源: activity.md §4 — 加入活动 — 错误码 ACTIVITY_FULL
  it('should throw error with code ACTIVITY_FULL', async () => {
    server.use(
      http.post('/api/activities/:id/join', () => {
        return HttpResponse.json(
          {
            error: { code: 'ACTIVITY_FULL', message: '活动已满员' },
          },
          { status: 409 },
        );
      }),
    );

    await expect(joinActivity('activity-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_FULL',
    });
  });

  // 来源: activity.md §4 — 加入活动 — 错误码 ACTIVITY_ALREADY_JOINED
  it('should throw error with code ACTIVITY_ALREADY_JOINED', async () => {
    server.use(
      http.post('/api/activities/:id/join', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_ALREADY_JOINED',
              message: '用户已加入该活动',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(joinActivity('activity-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_ALREADY_JOINED',
    });
  });

  // 来源: activity.md §4 — 加入活动 — 错误码 ACTIVITY_NOT_JOINABLE
  it('should throw error with code ACTIVITY_NOT_JOINABLE', async () => {
    server.use(
      http.post('/api/activities/:id/join', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_JOINABLE',
              message: '活动状态不允许加入',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(joinActivity('activity-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_JOINABLE',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/activities/:id/leave — 退出活动
// ---------------------------------------------------------------------------

describe('leaveActivity API', () => {
  // 来源: activity.md §4 — 退出活动 — Request (POST 方法、URL)
  it('should send POST request to /api/activities/:id/leave', async () => {
    let capturedUrl = '';

    server.use(
      http.post('/api/activities/:id/leave', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: {
            activityId: 'activity-uuid-1',
            userId: 'user-uuid-2',
            currentParticipants: 3,
            status: 'open',
          },
        });
      }),
    );

    await leaveActivity('activity-uuid-1');

    expect(capturedUrl).toContain('/api/activities/activity-uuid-1/leave');
  });

  // 来源: activity.md §4 — 退出活动 — Response 200
  it('should return leave result from successful response', async () => {
    server.use(
      http.post('/api/activities/:id/leave', () => {
        return HttpResponse.json({
          data: {
            activityId: 'activity-uuid-1',
            userId: 'user-uuid-2',
            currentParticipants: 3,
            status: 'open',
          },
        });
      }),
    );

    const result = await leaveActivity('activity-uuid-1');

    expect(result).toEqual({
      activityId: 'activity-uuid-1',
      userId: 'user-uuid-2',
      currentParticipants: 3,
      status: 'open',
    });
  });

  // 来源: activity.md §4 — 退出活动 — 错误码 ACTIVITY_NOT_FOUND
  it('should throw error with code ACTIVITY_NOT_FOUND', async () => {
    server.use(
      http.post('/api/activities/:id/leave', () => {
        return HttpResponse.json(
          {
            error: { code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' },
          },
          { status: 404 },
        );
      }),
    );

    await expect(leaveActivity('non-existent')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
    });
  });

  // 来源: activity.md §4 — 退出活动 — 错误码 ACTIVITY_CREATOR_CANNOT_LEAVE
  it('should throw error with code ACTIVITY_CREATOR_CANNOT_LEAVE', async () => {
    server.use(
      http.post('/api/activities/:id/leave', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_CREATOR_CANNOT_LEAVE',
              message: '发起人不能退出活动',
            },
          },
          { status: 403 },
        );
      }),
    );

    await expect(leaveActivity('activity-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_CREATOR_CANNOT_LEAVE',
    });
  });

  // 来源: activity.md §4 — 退出活动 — 错误码 ACTIVITY_NOT_LEAVABLE
  it('should throw error with code ACTIVITY_NOT_LEAVABLE', async () => {
    server.use(
      http.post('/api/activities/:id/leave', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_LEAVABLE',
              message: '活动状态不允许退出',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(leaveActivity('activity-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_LEAVABLE',
    });
  });

  // 来源: activity.md §4 — 退出活动 — 错误码 ACTIVITY_NOT_PARTICIPANT
  it('should throw error with code ACTIVITY_NOT_PARTICIPANT', async () => {
    server.use(
      http.post('/api/activities/:id/leave', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_PARTICIPANT',
              message: '你不是该活动的参与者',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(leaveActivity('activity-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_PARTICIPANT',
    });
  });
});

// ---------------------------------------------------------------------------
// PUT /api/activities/:id — 修改活动
// ---------------------------------------------------------------------------

describe('updateActivity API', () => {
  // 来源: activity.md §4 — 修改活动 — Request (PUT 方法、URL、Body)
  it('should send PUT request to /api/activities/:id with update data', async () => {
    let capturedBody: unknown = null;
    let capturedUrl = '';

    server.use(
      http.put('/api/activities/:id', async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            ...mockActivityListItem,
            maxParticipants: 10,
          },
        });
      }),
    );

    await updateActivity('activity-uuid-1', {
      maxParticipants: 10,
    });

    expect(capturedUrl).toContain('/api/activities/activity-uuid-1');
    expect(capturedBody).toEqual({
      maxParticipants: 10,
    });
  });

  // 来源: activity.md §4 — 修改活动 — Request Body — 支持部分更新
  it('should support partial update with only provided fields', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.put('/api/activities/:id', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            ...mockActivityListItem,
            title: '新标题',
          },
        });
      }),
    );

    await updateActivity('activity-uuid-1', {
      title: '新标题',
      startTime: '2026-04-05T15:00:00.000Z',
    });

    expect(capturedBody).toEqual({
      title: '新标题',
      startTime: '2026-04-05T15:00:00.000Z',
    });
  });

  // 来源: activity.md §4 — 修改活动 — Request Body — 包含 venueId
  it('should include venueId in update data when changing venue', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.put('/api/activities/:id', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            ...mockActivityListItem,
            venue: { ...mockVenue, id: 'venue-uuid-2' },
          },
        });
      }),
    );

    await updateActivity('activity-uuid-1', {
      venueId: 'venue-uuid-2',
    });

    expect(capturedBody).toEqual({
      venueId: 'venue-uuid-2',
    });
  });

  // 来源: activity.md §4 — 修改活动 — Response 200
  it('should return updated activity from successful response', async () => {
    const updatedActivity = {
      ...mockActivityListItem,
      maxParticipants: 10,
      startTime: '2026-04-05T15:00:00.000Z',
    };

    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json({ data: updatedActivity });
      }),
    );

    const result = await updateActivity('activity-uuid-1', {
      maxParticipants: 10,
      startTime: '2026-04-05T15:00:00.000Z',
    });

    expect(result.maxParticipants).toBe(10);
    expect(result.startTime).toBe('2026-04-05T15:00:00.000Z');
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_NOT_CREATOR
  it('should throw error with code ACTIVITY_NOT_CREATOR', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_CREATOR',
              message: '非发起人尝试修改活动',
            },
          },
          { status: 403 },
        );
      }),
    );

    await expect(
      updateActivity('activity-uuid-1', { title: '新标题' }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_CREATOR',
    });
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_NOT_MODIFIABLE
  it('should throw error with code ACTIVITY_NOT_MODIFIABLE', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_MODIFIABLE',
              message: '活动状态不允许修改',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(
      updateActivity('activity-uuid-1', { title: '新标题' }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_MODIFIABLE',
    });
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_PARTICIPANTS_EXCEED
  it('should throw error with code ACTIVITY_PARTICIPANTS_EXCEED', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_PARTICIPANTS_EXCEED',
              message: 'maxParticipants 小于当前参与人数',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateActivity('activity-uuid-1', { maxParticipants: 1 }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_PARTICIPANTS_EXCEED',
    });
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_INVALID_VENUE
  it('should throw error with code ACTIVITY_INVALID_VENUE', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_VENUE',
              message: 'venueId 格式不合法',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateActivity('activity-uuid-1', { venueId: '' }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_VENUE',
    });
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_INVALID_TIME
  it('should throw error with code ACTIVITY_INVALID_TIME', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_TIME',
              message: '开始时间不晚于当前时间，或结束时间不晚于开始时间',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateActivity('activity-uuid-1', {
        startTime: '2020-01-01T00:00:00.000Z',
        endTime: '2020-01-01T02:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TIME',
    });
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_INVALID_PARTICIPANTS
  it('should throw error with code ACTIVITY_INVALID_PARTICIPANTS', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_PARTICIPANTS',
              message: 'maxParticipants 不在 2-50 范围内',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateActivity('activity-uuid-1', { maxParticipants: 0 }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_PARTICIPANTS',
    });
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_INVALID_TITLE
  it('should throw error with code ACTIVITY_INVALID_TITLE', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_INVALID_TITLE',
              message: 'title 超过 50 字符',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateActivity('activity-uuid-1', { title: 'a'.repeat(51) }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TITLE',
    });
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_NOT_FOUND
  it('should throw error with code ACTIVITY_NOT_FOUND', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_FOUND',
              message: '活动不存在',
            },
          },
          { status: 404 },
        );
      }),
    );

    await expect(
      updateActivity('non-existent-id', { title: '新标题' }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
    });
  });

  // 来源: activity.md §4 — 修改活动 — 错误码 ACTIVITY_VENUE_NOT_FOUND
  it('should throw error with code ACTIVITY_VENUE_NOT_FOUND when changing to non-existent venue', async () => {
    server.use(
      http.put('/api/activities/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_VENUE_NOT_FOUND',
              message: '球馆不存在',
            },
          },
          { status: 404 },
        );
      }),
    );

    await expect(
      updateActivity('activity-uuid-1', { venueId: 'non-existent-venue' }),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_VENUE_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/activities/:id/cancel — 取消活动
// ---------------------------------------------------------------------------

describe('cancelActivity API', () => {
  // 来源: activity.md §4 — 取消活动 — Request (POST 方法、URL、无 Body)
  it('should send POST request to /api/activities/:id/cancel', async () => {
    let capturedUrl = '';

    server.use(
      http.post('/api/activities/:id/cancel', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { id: 'activity-uuid-1', status: 'cancelled' },
        });
      }),
    );

    await cancelActivity('activity-uuid-1');

    expect(capturedUrl).toContain('/api/activities/activity-uuid-1/cancel');
  });

  // 来源: activity.md §4 — 取消活动 — Response 200
  it('should return cancelled activity from successful response', async () => {
    server.use(
      http.post('/api/activities/:id/cancel', () => {
        return HttpResponse.json({
          data: { id: 'activity-uuid-1', status: 'cancelled' },
        });
      }),
    );

    const result = await cancelActivity('activity-uuid-1');

    expect(result).toEqual({
      id: 'activity-uuid-1',
      status: 'cancelled',
    });
  });

  // 来源: activity.md §4 — 取消活动 — 错误码 ACTIVITY_NOT_FOUND
  it('should throw error with code ACTIVITY_NOT_FOUND', async () => {
    server.use(
      http.post('/api/activities/:id/cancel', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_FOUND',
              message: '活动不存在',
            },
          },
          { status: 404 },
        );
      }),
    );

    await expect(cancelActivity('non-existent')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
    });
  });

  // 来源: activity.md §4 — 取消活动 — 错误码 ACTIVITY_NOT_CREATOR
  it('should throw error with code ACTIVITY_NOT_CREATOR', async () => {
    server.use(
      http.post('/api/activities/:id/cancel', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_CREATOR',
              message: '非发起人尝试取消活动',
            },
          },
          { status: 403 },
        );
      }),
    );

    await expect(cancelActivity('activity-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_CREATOR',
    });
  });

  // 来源: activity.md §4 — 取消活动 — 错误码 ACTIVITY_NOT_CANCELLABLE
  it('should throw error with code ACTIVITY_NOT_CANCELLABLE', async () => {
    server.use(
      http.post('/api/activities/:id/cancel', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACTIVITY_NOT_CANCELLABLE',
              message: '活动状态不允许取消',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(cancelActivity('activity-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_CANCELLABLE',
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id/activities — 用户活动列表
// ---------------------------------------------------------------------------

describe('getUserActivities API', () => {
  // 来源: activity.md §4 — 用户参与的活动列表 — Request (GET 方法、URL 含 userId)
  it('should send GET request to /api/users/:id/activities', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getUserActivities('user-uuid-1', {});

    expect(capturedUrl).toContain('/api/users/user-uuid-1/activities');
  });

  // 来源: activity.md §4 — 用户参与的活动列表 — Query Params (page, pageSize)
  it('should pass pagination params as query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 2, pageSize: 10 },
        });
      }),
    );

    await getUserActivities('user-uuid-1', { page: 2, pageSize: 10 });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });

  // 来源: activity.md §4 — 用户参与的活动列表 — Query Params (role)
  it('should pass role filter as query parameter', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getUserActivities('user-uuid-1', { role: 'creator' });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('role')).toBe('creator');
  });

  // 来源: activity.md §4 — 用户参与的活动列表 — Query Params (status)
  it('should pass status filter as query parameter', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getUserActivities('user-uuid-1', { status: 'completed' });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('status')).toBe('completed');
  });

  // 来源: activity.md §4 — 用户参与的活动列表 — Response 200
  it('should return paginated activity list from successful response', async () => {
    const userActivityItem = { ...mockActivityListItem };
    delete (userActivityItem as Record<string, unknown>).distance;

    server.use(
      http.get('/api/users/:id/activities', () => {
        return HttpResponse.json({
          data: {
            items: [userActivityItem],
            total: 15,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getUserActivities('user-uuid-1', {});

    expect(result).toEqual({
      items: [userActivityItem],
      total: 15,
      page: 1,
      pageSize: 20,
    });
  });

  // 来源: activity.md §4 — 用户参与的活动列表 — 空列表（用户不存在返回空列表）
  it('should return empty list for non-existent user', async () => {
    server.use(
      http.get('/api/users/:id/activities', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    const result = await getUserActivities('non-existent-user', {});

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
