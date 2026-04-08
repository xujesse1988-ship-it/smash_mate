/**
 * 契约测试: web-app/notification — API 调用层
 * 覆盖接口:
 *   - GET /api/notifications（通知列表）
 *   - GET /api/notifications/unread-count（未读通知数）
 *   - PUT /api/notifications/:id/read（标记单条已读）
 *   - PUT /api/notifications/read-all（全部标记已读）
 *
 * 来源文档:
 *   - docs/module-design/notification.md §4 接口契约
 *   - docs/module-design/web-app-notification.md §5 消费的后端接口汇总
 *
 * Mock 策略:
 *   - MSW (Mock Service Worker) 拦截 HTTP 请求
 *   - 验证请求 URL、HTTP 方法、请求参数格式
 *   - 验证成功响应和错误响应的解析
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '@web/features/notification/api/notification-api';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

describe('getNotifications API', () => {
  // 来源: notification.md §4 — 通知列表 — Request（URL + Method）
  it('should send GET request to /api/notifications', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.get('/api/notifications', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    await getNotifications({});

    expect(capturedUrl).toBe('/api/notifications');
    expect(capturedMethod).toBe('GET');
  });

  // 来源: notification.md §4 — 通知列表 — Query Params（page, pageSize）
  it('should pass page and pageSize as query parameters', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/notifications', ({ request }) => {
        capturedSearchParams = new URL(request.url).searchParams;
        return HttpResponse.json({
          data: {
            items: [],
            total: 0,
            page: 2,
            pageSize: 10,
          },
        });
      }),
    );

    await getNotifications({ page: 2, pageSize: 10 });

    expect(capturedSearchParams!.get('page')).toBe('2');
    expect(capturedSearchParams!.get('pageSize')).toBe('10');
  });

  // 来源: notification.md §4 — 通知列表 — Query Params（isRead 筛选）
  it('should pass isRead as query parameter when specified', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/notifications', ({ request }) => {
        capturedSearchParams = new URL(request.url).searchParams;
        return HttpResponse.json({
          data: {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    await getNotifications({ isRead: false });

    expect(capturedSearchParams!.get('isRead')).toBe('false');
  });

  // 来源: notification.md §4 — 通知列表 — Query Params（isRead=true 筛选已读）
  it('should pass isRead=true as query parameter when filtering read notifications', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/notifications', ({ request }) => {
        capturedSearchParams = new URL(request.url).searchParams;
        return HttpResponse.json({
          data: {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    await getNotifications({ isRead: true });

    expect(capturedSearchParams!.get('isRead')).toBe('true');
  });

  // 来源: notification.md §4 — 通知列表 — Query Params（isRead 不传时返回全部）
  it('should not include isRead parameter when not specified', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/notifications', ({ request }) => {
        capturedSearchParams = new URL(request.url).searchParams;
        return HttpResponse.json({
          data: {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    await getNotifications({});

    expect(capturedSearchParams!.has('isRead')).toBe(false);
  });

  // 来源: notification.md §4 — 通知列表 — Response 200
  it('should return paginated notification list from successful response', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'notif-uuid-1',
                type: 'ACTIVITY_JOINED',
                title: '新成员加入',
                content: '张三 加入了你的活动「朝阳体育中心 04/05」',
                targetType: 'activity',
                targetId: 'activity-uuid-1',
                isRead: false,
                createdAt: '2026-04-02T10:00:00.000Z',
              },
              {
                id: 'notif-uuid-2',
                type: 'GROUP_CLASS_ENROLLED',
                title: '新学员报名',
                content: '李四 报名了你的团课「初级训练营」',
                targetType: 'group-class',
                targetId: 'gc-uuid-1',
                isRead: true,
                createdAt: '2026-04-01T09:00:00.000Z',
              },
            ],
            total: 50,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getNotifications({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(50);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  // 来源: notification.md §4 — 通知列表 — Response 200 — items 字段结构
  it('should return notification items with correct fields', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'notif-uuid-1',
                type: 'ACTIVITY_JOINED',
                title: '新成员加入',
                content: '张三 加入了你的活动「朝阳体育中心 04/05」',
                targetType: 'activity',
                targetId: 'activity-uuid-1',
                isRead: false,
                createdAt: '2026-04-02T10:00:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getNotifications({});
    const item = result.items[0];

    expect(item).toEqual({
      id: 'notif-uuid-1',
      type: 'ACTIVITY_JOINED',
      title: '新成员加入',
      content: '张三 加入了你的活动「朝阳体育中心 04/05」',
      targetType: 'activity',
      targetId: 'activity-uuid-1',
      isRead: false,
      createdAt: '2026-04-02T10:00:00.000Z',
    });
  });

  // 来源: notification.md §4 — 通知列表 — 业务规则 — 按 createdAt 倒序排列
  it('should return items sorted by createdAt in descending order', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'notif-uuid-1',
                type: 'ACTIVITY_JOINED',
                title: '最新通知',
                content: '内容1',
                targetType: 'activity',
                targetId: 'activity-uuid-1',
                isRead: false,
                createdAt: '2026-04-03T10:00:00.000Z',
              },
              {
                id: 'notif-uuid-2',
                type: 'GROUP_CLASS_ENROLLED',
                title: '较早通知',
                content: '内容2',
                targetType: 'group-class',
                targetId: 'gc-uuid-1',
                isRead: true,
                createdAt: '2026-04-02T10:00:00.000Z',
              },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getNotifications({});

    const firstDate = new Date(result.items[0].createdAt).getTime();
    const secondDate = new Date(result.items[1].createdAt).getTime();
    expect(firstDate).toBeGreaterThan(secondDate);
  });

  // 来源: notification.md §4 — 通知列表 — 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(getNotifications({})).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count
// ---------------------------------------------------------------------------

describe('getUnreadCount API', () => {
  // 来源: notification.md §4 — 未读通知数 — Request（URL + Method，无参数）
  it('should send GET request to /api/notifications/unread-count', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.get('/api/notifications/unread-count', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            count: 5,
          },
        });
      }),
    );

    await getUnreadCount();

    expect(capturedUrl).toBe('/api/notifications/unread-count');
    expect(capturedMethod).toBe('GET');
  });

  // 来源: notification.md §4 — 未读通知数 — Response 200
  it('should return unread count from successful response', async () => {
    server.use(
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({
          data: {
            count: 5,
          },
        });
      }),
    );

    const result = await getUnreadCount();

    expect(result).toEqual({ count: 5 });
  });

  // 来源: notification.md §4 — 未读通知数 — 业务规则 — 无未读时 count 为 0
  it('should return count as 0 when there are no unread notifications', async () => {
    server.use(
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({
          data: {
            count: 0,
          },
        });
      }),
    );

    const result = await getUnreadCount();

    expect(result.count).toBe(0);
  });

  // 来源: notification.md §4 — 未读通知数 — 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(getUnreadCount()).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });
});

// ---------------------------------------------------------------------------
// PUT /api/notifications/:id/read
// ---------------------------------------------------------------------------

describe('markAsRead API', () => {
  // 来源: notification.md §4 — 标记单条已读 — Request（URL + Method + Path Params）
  it('should send PUT request to /api/notifications/:id/read', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.put('/api/notifications/:id/read', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            id: 'notif-uuid-1',
            type: 'ACTIVITY_JOINED',
            title: '新成员加入',
            content: '张三 加入了你的活动「朝阳体育中心 04/05」',
            targetType: 'activity',
            targetId: 'activity-uuid-1',
            isRead: true,
            createdAt: '2026-04-02T10:00:00.000Z',
          },
        });
      }),
    );

    await markAsRead('notif-uuid-1');

    expect(capturedUrl).toBe('/api/notifications/notif-uuid-1/read');
    expect(capturedMethod).toBe('PUT');
  });

  // 来源: notification.md §4 — 标记单条已读 — Request Body — 无请求体
  it('should not send request body', async () => {
    let capturedBody: string | null = null;

    server.use(
      http.put('/api/notifications/:id/read', async ({ request }) => {
        const text = await request.text();
        capturedBody = text || null;
        return HttpResponse.json({
          data: {
            id: 'notif-uuid-1',
            type: 'ACTIVITY_JOINED',
            title: '新成员加入',
            content: '内容',
            targetType: 'activity',
            targetId: 'activity-uuid-1',
            isRead: true,
            createdAt: '2026-04-02T10:00:00.000Z',
          },
        });
      }),
    );

    await markAsRead('notif-uuid-1');

    // 标记已读不需要请求体
    expect(capturedBody).toBeNull();
  });

  // 来源: notification.md §4 — 标记单条已读 — Response 200
  it('should return updated notification with isRead=true from successful response', async () => {
    server.use(
      http.put('/api/notifications/:id/read', () => {
        return HttpResponse.json({
          data: {
            id: 'notif-uuid-1',
            type: 'ACTIVITY_JOINED',
            title: '新成员加入',
            content: '张三 加入了你的活动「朝阳体育中心 04/05」',
            targetType: 'activity',
            targetId: 'activity-uuid-1',
            isRead: true,
            createdAt: '2026-04-02T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await markAsRead('notif-uuid-1');

    expect(result).toEqual({
      id: 'notif-uuid-1',
      type: 'ACTIVITY_JOINED',
      title: '新成员加入',
      content: '张三 加入了你的活动「朝阳体育中心 04/05」',
      targetType: 'activity',
      targetId: 'activity-uuid-1',
      isRead: true,
      createdAt: '2026-04-02T10:00:00.000Z',
    });
  });

  // 来源: notification.md §4 — 标记单条已读 — 业务规则 — 幂等操作
  it('should return notification with isRead=true even if already read (idempotent)', async () => {
    server.use(
      http.put('/api/notifications/:id/read', () => {
        return HttpResponse.json({
          data: {
            id: 'notif-uuid-1',
            type: 'ACTIVITY_JOINED',
            title: '新成员加入',
            content: '内容',
            targetType: 'activity',
            targetId: 'activity-uuid-1',
            isRead: true,
            createdAt: '2026-04-02T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await markAsRead('notif-uuid-1');

    expect(result.isRead).toBe(true);
  });

  // 来源: notification.md §4 — 标记单条已读 — 错误码 NOTIFICATION_NOT_FOUND
  it('should throw error with code NOTIFICATION_NOT_FOUND when notification does not exist', async () => {
    server.use(
      http.put('/api/notifications/:id/read', () => {
        return HttpResponse.json(
          {
            error: { code: 'NOTIFICATION_NOT_FOUND', message: '通知不存在' },
          },
          { status: 404 },
        );
      }),
    );

    await expect(markAsRead('nonexistent-id')).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
    });
  });

  // 来源: notification.md §4 — 标记单条已读 — 错误码 NOTIFICATION_FORBIDDEN
  it('should throw error with code NOTIFICATION_FORBIDDEN when marking others notification', async () => {
    server.use(
      http.put('/api/notifications/:id/read', () => {
        return HttpResponse.json(
          {
            error: { code: 'NOTIFICATION_FORBIDDEN', message: '无权操作此通知' },
          },
          { status: 403 },
        );
      }),
    );

    await expect(markAsRead('others-notif-id')).rejects.toMatchObject({
      code: 'NOTIFICATION_FORBIDDEN',
    });
  });

  // 来源: notification.md §4 — 标记单条已读 — 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.put('/api/notifications/:id/read', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(markAsRead('notif-uuid-1')).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });
});

// ---------------------------------------------------------------------------
// PUT /api/notifications/read-all
// ---------------------------------------------------------------------------

describe('markAllAsRead API', () => {
  // 来源: notification.md §4 — 全部标记已读 — Request（URL + Method）
  it('should send PUT request to /api/notifications/read-all', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.put('/api/notifications/read-all', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            updatedCount: 12,
          },
        });
      }),
    );

    await markAllAsRead();

    expect(capturedUrl).toBe('/api/notifications/read-all');
    expect(capturedMethod).toBe('PUT');
  });

  // 来源: notification.md §4 — 全部标记已读 — Request Body — 无请求体
  it('should not send request body', async () => {
    let capturedBody: string | null = null;

    server.use(
      http.put('/api/notifications/read-all', async ({ request }) => {
        const text = await request.text();
        capturedBody = text || null;
        return HttpResponse.json({
          data: {
            updatedCount: 5,
          },
        });
      }),
    );

    await markAllAsRead();

    expect(capturedBody).toBeNull();
  });

  // 来源: notification.md §4 — 全部标记已读 — Response 200
  it('should return updatedCount from successful response', async () => {
    server.use(
      http.put('/api/notifications/read-all', () => {
        return HttpResponse.json({
          data: {
            updatedCount: 12,
          },
        });
      }),
    );

    const result = await markAllAsRead();

    expect(result).toEqual({ updatedCount: 12 });
  });

  // 来源: notification.md §4 — 全部标记已读 — 业务规则 — 无未读通知时 updatedCount 为 0
  it('should return updatedCount as 0 when there are no unread notifications', async () => {
    server.use(
      http.put('/api/notifications/read-all', () => {
        return HttpResponse.json({
          data: {
            updatedCount: 0,
          },
        });
      }),
    );

    const result = await markAllAsRead();

    expect(result.updatedCount).toBe(0);
  });

  // 来源: notification.md §4 — 全部标记已读 — 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.put('/api/notifications/read-all', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(markAllAsRead()).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });
});
