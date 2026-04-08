/**
 * 契约测试: admin/venue-management — API 调用层
 * 覆盖接口:
 *   - GET /api/admin/cities（城市列表）
 *   - POST /api/admin/cities（添加城市）
 *   - GET /api/admin/venues（球馆列表）
 *   - DELETE /api/admin/venues/:id（移除球馆）
 *   - POST /api/admin/venues/sync（手动触发球馆数据同步）
 *
 * 来源文档:
 *   - docs/module-design/admin.md §8.2 CityManagementPage — 调用的后端接口
 *   - docs/module-design/admin.md §8.3 VenueManagementPage — 调用的后端接口
 *   - docs/module-design/admin.md §11 消费的后端接口汇总
 *   - docs/module-design/venue.md §4 — 管理员接口
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
  getCities,
  createCity,
  getAdminVenues,
  deleteVenue,
  syncVenues,
} from '@admin/features/venue-management/api/venue-management-api';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// GET /api/admin/cities
// ---------------------------------------------------------------------------

describe('getCities API', () => {
  // 来源: venue.md §4 — 城市列表（管理员）— Request（URL + Method）
  it('should send GET request to /api/admin/cities', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.get('/api/admin/cities', ({ request }) => {
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

    await getCities({});

    expect(capturedUrl).toBe('/api/admin/cities');
    expect(capturedMethod).toBe('GET');
  });

  // 来源: venue.md §4 — 城市列表（管理员）— Query Params（page, pageSize）
  it('should pass page and pageSize as query parameters', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/admin/cities', ({ request }) => {
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

    await getCities({ page: 2, pageSize: 10 });

    expect(capturedSearchParams!.get('page')).toBe('2');
    expect(capturedSearchParams!.get('pageSize')).toBe('10');
  });

  // 来源: venue.md §4 — 城市列表（管理员）— Response 200
  it('should return paginated city list from successful response', async () => {
    server.use(
      http.get('/api/admin/cities', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'city-uuid-1',
                name: '北京',
                venueCount: 42,
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-01T10:00:00.000Z',
              },
              {
                id: 'city-uuid-2',
                name: '上海',
                venueCount: 38,
                createdAt: '2026-04-01T11:00:00.000Z',
                updatedAt: '2026-04-02T08:00:00.000Z',
              },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getCities({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  // 来源: venue.md §4 — 城市列表（管理员）— Response 200 — items 字段结构
  it('should return city items with correct fields', async () => {
    server.use(
      http.get('/api/admin/cities', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'city-uuid-1',
                name: '北京',
                venueCount: 42,
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-01T10:00:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getCities({});
    const item = result.items[0];

    expect(item).toEqual({
      id: 'city-uuid-1',
      name: '北京',
      venueCount: 42,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    });
  });

  // 来源: venue.md §4 — 城市列表（管理员）— 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.get('/api/admin/cities', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(getCities({})).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  // 来源: venue.md §4 — 城市列表（管理员）— 错误码 AUTH_ADMIN_REQUIRED
  it('should throw error with code AUTH_ADMIN_REQUIRED when user is not admin', async () => {
    server.use(
      http.get('/api/admin/cities', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_ADMIN_REQUIRED', message: '非管理员身份' },
          },
          { status: 403 },
        );
      }),
    );

    await expect(getCities({})).rejects.toMatchObject({
      code: 'AUTH_ADMIN_REQUIRED',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/cities
// ---------------------------------------------------------------------------

describe('createCity API', () => {
  // 来源: venue.md §4 — 添加城市（管理员）— Request（URL + Method）
  it('should send POST request to /api/admin/cities', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.post('/api/admin/cities', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json(
          {
            data: {
              id: 'city-uuid-1',
              name: '北京',
              venueCount: 42,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    await createCity('北京');

    expect(capturedUrl).toBe('/api/admin/cities');
    expect(capturedMethod).toBe('POST');
  });

  // 来源: venue.md §4 — 添加城市（管理员）— Request Body（name）
  it('should send city name in request body', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/admin/cities', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            data: {
              id: 'city-uuid-1',
              name: '北京',
              venueCount: 42,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    await createCity('北京');

    expect(capturedBody).toEqual({ name: '北京' });
  });

  // 来源: venue.md §4 — 添加城市（管理员）— Response 201
  it('should return created city with venueCount from successful response', async () => {
    server.use(
      http.post('/api/admin/cities', () => {
        return HttpResponse.json(
          {
            data: {
              id: 'city-uuid-1',
              name: '北京',
              venueCount: 42,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    const result = await createCity('北京');

    expect(result).toEqual({
      id: 'city-uuid-1',
      name: '北京',
      venueCount: 42,
      createdAt: '2026-04-01T10:00:00.000Z',
    });
  });

  // 来源: venue.md §4 — 添加城市（管理员）— 业务规则 — 地图服务失败时 venueCount 为 0
  it('should return city with venueCount 0 when map service fails', async () => {
    server.use(
      http.post('/api/admin/cities', () => {
        return HttpResponse.json(
          {
            data: {
              id: 'city-uuid-1',
              name: '北京',
              venueCount: 0,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );

    const result = await createCity('北京');

    expect(result.venueCount).toBe(0);
  });

  // 来源: venue.md §4 — 添加城市（管理员）— 错误码 VENUE_INVALID_CITY_NAME
  it('should throw error with code VENUE_INVALID_CITY_NAME when city name is empty', async () => {
    server.use(
      http.post('/api/admin/cities', () => {
        return HttpResponse.json(
          {
            error: { code: 'VENUE_INVALID_CITY_NAME', message: '城市名称为空' },
          },
          { status: 400 },
        );
      }),
    );

    await expect(createCity('')).rejects.toMatchObject({
      code: 'VENUE_INVALID_CITY_NAME',
    });
  });

  // 来源: venue.md §4 — 添加城市（管理员）— 错误码 VENUE_CITY_DUPLICATE
  it('should throw error with code VENUE_CITY_DUPLICATE when city already exists', async () => {
    server.use(
      http.post('/api/admin/cities', () => {
        return HttpResponse.json(
          {
            error: { code: 'VENUE_CITY_DUPLICATE', message: '城市名称已存在' },
          },
          { status: 409 },
        );
      }),
    );

    await expect(createCity('北京')).rejects.toMatchObject({
      code: 'VENUE_CITY_DUPLICATE',
    });
  });

  // 来源: venue.md §4 — 添加城市（管理员）— 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.post('/api/admin/cities', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(createCity('北京')).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  // 来源: venue.md §4 — 添加城市（管理员）— 错误码 AUTH_ADMIN_REQUIRED
  it('should throw error with code AUTH_ADMIN_REQUIRED when user is not admin', async () => {
    server.use(
      http.post('/api/admin/cities', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_ADMIN_REQUIRED', message: '非管理员身份' },
          },
          { status: 403 },
        );
      }),
    );

    await expect(createCity('北京')).rejects.toMatchObject({
      code: 'AUTH_ADMIN_REQUIRED',
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/venues
// ---------------------------------------------------------------------------

describe('getAdminVenues API', () => {
  // 来源: venue.md §4 — 球馆列表（管理员）— Request（URL + Method）
  it('should send GET request to /api/admin/venues', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.get('/api/admin/venues', ({ request }) => {
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

    await getAdminVenues({});

    expect(capturedUrl).toBe('/api/admin/venues');
    expect(capturedMethod).toBe('GET');
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— Query Params（page, pageSize）
  it('should pass page and pageSize as query parameters', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/admin/venues', ({ request }) => {
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

    await getAdminVenues({ page: 2, pageSize: 10 });

    expect(capturedSearchParams!.get('page')).toBe('2');
    expect(capturedSearchParams!.get('pageSize')).toBe('10');
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— Query Params（cityId 筛选）
  it('should pass cityId as query parameter when specified', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/admin/venues', ({ request }) => {
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

    await getAdminVenues({ cityId: 'city-uuid-1' });

    expect(capturedSearchParams!.get('cityId')).toBe('city-uuid-1');
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— Query Params（keyword 搜索）
  it('should pass keyword as query parameter when specified', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/admin/venues', ({ request }) => {
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

    await getAdminVenues({ keyword: '朝阳' });

    expect(capturedSearchParams!.get('keyword')).toBe('朝阳');
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— Query Params — cityId 和 keyword 组合筛选
  it('should pass both cityId and keyword as query parameters when specified', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/admin/venues', ({ request }) => {
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

    await getAdminVenues({ cityId: 'city-uuid-1', keyword: '朝阳', page: 1, pageSize: 20 });

    expect(capturedSearchParams!.get('cityId')).toBe('city-uuid-1');
    expect(capturedSearchParams!.get('keyword')).toBe('朝阳');
    expect(capturedSearchParams!.get('page')).toBe('1');
    expect(capturedSearchParams!.get('pageSize')).toBe('20');
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— Query Params — 不传可选参数时不包含
  it('should not include cityId and keyword when not specified', async () => {
    let capturedSearchParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/admin/venues', ({ request }) => {
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

    await getAdminVenues({});

    expect(capturedSearchParams!.has('cityId')).toBe(false);
    expect(capturedSearchParams!.has('keyword')).toBe(false);
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— Response 200
  it('should return paginated venue list from successful response', async () => {
    server.use(
      http.get('/api/admin/venues', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'venue-uuid-1',
                name: '朝阳体育中心羽毛球馆',
                address: '北京市朝阳区...',
                latitude: 39.9215,
                longitude: 116.4435,
                cityId: 'city-uuid-1',
                cityName: '北京',
                createdAt: '2026-04-01T10:00:00.000Z',
              },
            ],
            total: 42,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getAdminVenues({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(42);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— Response 200 — items 字段结构
  it('should return venue items with correct fields', async () => {
    server.use(
      http.get('/api/admin/venues', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'venue-uuid-1',
                name: '朝阳体育中心羽毛球馆',
                address: '北京市朝阳区...',
                latitude: 39.9215,
                longitude: 116.4435,
                cityId: 'city-uuid-1',
                cityName: '北京',
                createdAt: '2026-04-01T10:00:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getAdminVenues({});
    const item = result.items[0];

    expect(item).toEqual({
      id: 'venue-uuid-1',
      name: '朝阳体育中心羽毛球馆',
      address: '北京市朝阳区...',
      latitude: 39.9215,
      longitude: 116.4435,
      cityId: 'city-uuid-1',
      cityName: '北京',
      createdAt: '2026-04-01T10:00:00.000Z',
    });
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.get('/api/admin/venues', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(getAdminVenues({})).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  // 来源: venue.md §4 — 球馆列表（管理员）— 错误码 AUTH_ADMIN_REQUIRED
  it('should throw error with code AUTH_ADMIN_REQUIRED when user is not admin', async () => {
    server.use(
      http.get('/api/admin/venues', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_ADMIN_REQUIRED', message: '非管理员身份' },
          },
          { status: 403 },
        );
      }),
    );

    await expect(getAdminVenues({})).rejects.toMatchObject({
      code: 'AUTH_ADMIN_REQUIRED',
    });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/venues/:id
// ---------------------------------------------------------------------------

describe('deleteVenue API', () => {
  // 来源: venue.md §4 — 移除球馆（管理员）— Request（URL + Method + Path Params）
  it('should send DELETE request to /api/admin/venues/:id', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.delete('/api/admin/venues/:id', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: { message: '球馆已移除' },
        });
      }),
    );

    await deleteVenue('venue-uuid-1');

    expect(capturedUrl).toBe('/api/admin/venues/venue-uuid-1');
    expect(capturedMethod).toBe('DELETE');
  });

  // 来源: venue.md §4 — 移除球馆（管理员）— Response 200
  it('should return success message from successful response', async () => {
    server.use(
      http.delete('/api/admin/venues/:id', () => {
        return HttpResponse.json({
          data: { message: '球馆已移除' },
        });
      }),
    );

    const result = await deleteVenue('venue-uuid-1');

    expect(result).toEqual({ message: '球馆已移除' });
  });

  // 来源: venue.md §4 — 移除球馆（管理员）— 错误码 VENUE_NOT_FOUND
  it('should throw error with code VENUE_NOT_FOUND when venue does not exist', async () => {
    server.use(
      http.delete('/api/admin/venues/:id', () => {
        return HttpResponse.json(
          {
            error: { code: 'VENUE_NOT_FOUND', message: '球馆不存在' },
          },
          { status: 404 },
        );
      }),
    );

    await expect(deleteVenue('nonexistent-id')).rejects.toMatchObject({
      code: 'VENUE_NOT_FOUND',
    });
  });

  // 来源: venue.md §4 — 移除球馆（管理员）— 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.delete('/api/admin/venues/:id', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(deleteVenue('venue-uuid-1')).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  // 来源: venue.md §4 — 移除球馆（管理员）— 错误码 AUTH_ADMIN_REQUIRED
  it('should throw error with code AUTH_ADMIN_REQUIRED when user is not admin', async () => {
    server.use(
      http.delete('/api/admin/venues/:id', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_ADMIN_REQUIRED', message: '非管理员身份' },
          },
          { status: 403 },
        );
      }),
    );

    await expect(deleteVenue('venue-uuid-1')).rejects.toMatchObject({
      code: 'AUTH_ADMIN_REQUIRED',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/venues/sync
// ---------------------------------------------------------------------------

describe('syncVenues API', () => {
  // 来源: venue.md §4 — 手动触发球馆数据更新（管理员）— Request（URL + Method）
  it('should send POST request to /api/admin/venues/sync', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.post('/api/admin/venues/sync', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            message: '球馆数据更新已触发',
            syncResults: [],
          },
        });
      }),
    );

    await syncVenues();

    expect(capturedUrl).toBe('/api/admin/venues/sync');
    expect(capturedMethod).toBe('POST');
  });

  // 来源: venue.md §4 — 手动触发球馆数据更新（管理员）— Request Body — 无
  it('should not send request body', async () => {
    let capturedBody: string | null = null;

    server.use(
      http.post('/api/admin/venues/sync', async ({ request }) => {
        const text = await request.text();
        capturedBody = text || null;
        return HttpResponse.json({
          data: {
            message: '球馆数据更新已触发',
            syncResults: [],
          },
        });
      }),
    );

    await syncVenues();

    // 同步接口不需要请求体
    expect(capturedBody).toBeNull();
  });

  // 来源: venue.md §4 — 手动触发球馆数据更新（管理员）— Response 200
  it('should return sync results from successful response', async () => {
    server.use(
      http.post('/api/admin/venues/sync', () => {
        return HttpResponse.json({
          data: {
            message: '球馆数据更新已触发',
            syncResults: [
              {
                cityId: 'city-uuid-1',
                cityName: '北京',
                newVenues: 3,
                updatedVenues: 5,
                totalVenues: 45,
              },
              {
                cityId: 'city-uuid-2',
                cityName: '上海',
                newVenues: 1,
                updatedVenues: 2,
                totalVenues: 38,
              },
            ],
          },
        });
      }),
    );

    const result = await syncVenues();

    expect(result.message).toBe('球馆数据更新已触发');
    expect(result.syncResults).toHaveLength(2);
    expect(result.syncResults[0]).toEqual({
      cityId: 'city-uuid-1',
      cityName: '北京',
      newVenues: 3,
      updatedVenues: 5,
      totalVenues: 45,
    });
    expect(result.syncResults[1]).toEqual({
      cityId: 'city-uuid-2',
      cityName: '上海',
      newVenues: 1,
      updatedVenues: 2,
      totalVenues: 38,
    });
  });

  // 来源: venue.md §4 — 手动触发球馆数据更新（管理员）— Response 200 — 空城市列表
  it('should return empty syncResults when no cities exist', async () => {
    server.use(
      http.post('/api/admin/venues/sync', () => {
        return HttpResponse.json({
          data: {
            message: '球馆数据更新已触发',
            syncResults: [],
          },
        });
      }),
    );

    const result = await syncVenues();

    expect(result.syncResults).toEqual([]);
  });

  // 来源: venue.md §4 — 手动触发球馆数据更新（管理员）— 错误码 VENUE_SYNC_IN_PROGRESS
  it('should throw error with code VENUE_SYNC_IN_PROGRESS when sync is already running', async () => {
    server.use(
      http.post('/api/admin/venues/sync', () => {
        return HttpResponse.json(
          {
            error: { code: 'VENUE_SYNC_IN_PROGRESS', message: '上一次同步尚未完成' },
          },
          { status: 409 },
        );
      }),
    );

    await expect(syncVenues()).rejects.toMatchObject({
      code: 'VENUE_SYNC_IN_PROGRESS',
    });
  });

  // 来源: venue.md §4 — 手动触发球馆数据更新（管理员）— 错误码 AUTH_UNAUTHORIZED
  it('should throw error with code AUTH_UNAUTHORIZED when token is missing or invalid', async () => {
    server.use(
      http.post('/api/admin/venues/sync', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(syncVenues()).rejects.toMatchObject({
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  // 来源: venue.md §4 — 手动触发球馆数据更新（管理员）— 错误码 AUTH_ADMIN_REQUIRED
  it('should throw error with code AUTH_ADMIN_REQUIRED when user is not admin', async () => {
    server.use(
      http.post('/api/admin/venues/sync', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_ADMIN_REQUIRED', message: '非管理员身份' },
          },
          { status: 403 },
        );
      }),
    );

    await expect(syncVenues()).rejects.toMatchObject({
      code: 'AUTH_ADMIN_REQUIRED',
    });
  });
});
