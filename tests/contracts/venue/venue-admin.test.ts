/**
 * 契约测试: venue 模块 — 城市与球馆管理接口（管理员）
 * 覆盖接口:
 *   - POST /api/admin/cities (VenueService.createCity)
 *   - GET /api/admin/cities (VenueService.getCityList)
 *   - GET /api/admin/venues (VenueService.getAdminVenueList)
 *   - DELETE /api/admin/venues/:id (VenueService.deleteVenue)
 *   - POST /api/admin/venues/sync (VenueService.syncVenues)
 *
 * 来源文档: docs/module-design/venue.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - VenueRepository: 全部 mock（隔离数据库依赖）
 * - 地图服务 API: mock（隔离外部依赖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenueService } from '@server/modules/venue/service.js';
import { VenueRepository } from '@server/modules/venue/repository.js';
import type {
  CreateCityInput,
  AdminCityListQuery,
  AdminVenueListQuery,
} from '@server/modules/venue/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock VenueRepository with all methods stubbed.
 * Individual tests override specific methods as needed.
 */
function createMockRepository(): {
  [K in keyof VenueRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findVenueById: vi.fn().mockResolvedValue(null),
    searchVenues: vi.fn().mockResolvedValue([]),
    createCity: vi.fn().mockResolvedValue({
      id: 'city-uuid-1',
      name: '北京',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    }),
    findCityByName: vi.fn().mockResolvedValue(null),
    findCities: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findAdminVenues: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    deleteVenue: vi.fn().mockResolvedValue(undefined),
    upsertVenues: vi.fn().mockResolvedValue({ newCount: 0, updatedCount: 0 }),
    getAllCities: vi.fn().mockResolvedValue([]),
    countVenuesByCity: vi.fn().mockResolvedValue(0),
  };
}

/** Standard city record as returned by repository */
function createCityRecord(
  overrides?: Partial<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: 'city-uuid-1',
    name: '北京',
    createdAt: new Date('2026-04-01T10:00:00.000Z'),
    updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    ...overrides,
  };
}

/** Standard venue record for admin list */
function createAdminVenueRecord(
  overrides?: Partial<{
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    cityId: string;
    cityName: string;
    createdAt: Date;
  }>,
) {
  return {
    id: 'venue-uuid-1',
    name: '朝阳体育中心羽毛球馆',
    address: '北京市朝阳区朝阳公园南路1号',
    latitude: 39.9215,
    longitude: 116.4435,
    cityId: 'city-uuid-1',
    cityName: '北京',
    createdAt: new Date('2026-04-01T10:00:00.000Z'),
    ...overrides,
  };
}

// ===========================================================================
// POST /api/admin/cities — VenueService.createCity
// ===========================================================================

describe('POST /api/admin/cities — VenueService.createCity', () => {
  let service: VenueService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new VenueService(repo as unknown as VenueRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should create a city and return city info with venueCount', async () => {
    // 业务规则: 管理员添加一个城市，添加后系统自动调用地图服务获取球馆
    // 来源: venue.md §4 添加城市 - Response 201
    repo.findCityByName.mockResolvedValue(null);
    repo.createCity.mockResolvedValue(createCityRecord({ id: 'city-new', name: '上海' }));

    const input: CreateCityInput = { name: '上海' };
    const result = await service.createCity(input);

    expect(result).toMatchObject({
      id: 'city-new',
      name: '上海',
      createdAt: expect.any(Date),
    });
    // venueCount should be present in the response
    expect(result).toHaveProperty('venueCount');
    expect(typeof result.venueCount).toBe('number');
  });

  it('should check for duplicate city name before creating', async () => {
    // 业务规则: 城市名称不可重复
    // 来源: venue.md §4 添加城市 - 业务规则 bullet 2
    repo.findCityByName.mockResolvedValue(null);
    repo.createCity.mockResolvedValue(createCityRecord());

    const input: CreateCityInput = { name: '北京' };
    await service.createCity(input);

    expect(repo.findCityByName).toHaveBeenCalledWith('北京');
  });

  it('should call map service to fetch venues after creating city', async () => {
    // 业务规则: 添加城市后，同步调用地图服务获取该城市的羽毛球场馆数据并入库
    // 来源: venue.md §4 添加城市 - 业务规则 bullet 3 + §6.1
    repo.findCityByName.mockResolvedValue(null);
    repo.createCity.mockResolvedValue(createCityRecord());

    const input: CreateCityInput = { name: '北京' };
    const result = await service.createCity(input);

    // venueCount reflects the number of venues fetched
    expect(result).toHaveProperty('venueCount');
  });

  it('should still create city when map service fails, returning venueCount 0', async () => {
    // 业务规则: 地图服务调用失败时：城市记录仍然创建成功，venueCount 为 0
    // 来源: venue.md §4 添加城市 - 业务规则 bullet 5
    repo.findCityByName.mockResolvedValue(null);
    repo.createCity.mockResolvedValue(createCityRecord({ name: '深圳' }));
    // Simulate map service failure — upsertVenues rejects with an error
    repo.upsertVenues.mockRejectedValue(new Error('Map service unavailable'));

    const input: CreateCityInput = { name: '深圳' };
    const result = await service.createCity(input);

    // City should still be created regardless of map service failure
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name', '深圳');
    // venueCount should be 0 when map service fails
    expect(result.venueCount).toBe(0);
  });

  it('should use upsertVenues to handle mapPoiId deduplication', async () => {
    // 业务规则: 地图服务返回的球馆通过 mapPoiId 去重：已存在的更新，不存在的新增
    // 来源: venue.md §4 添加城市 - 业务规则 bullet 4
    repo.findCityByName.mockResolvedValue(null);
    repo.createCity.mockResolvedValue(createCityRecord());

    const input: CreateCityInput = { name: '北京' };
    await service.createCity(input);

    // The service should call upsertVenues (which handles mapPoiId-based deduplication)
    expect(repo.upsertVenues).toHaveBeenCalledTimes(1);
    // upsertVenues should receive the city ID so venues are linked to the correct city
    const callArgs = repo.upsertVenues.mock.calls[0];
    expect(callArgs[0]).toBe('city-uuid-1');
  });

  it('should perform case-insensitive duplicate check for city name', async () => {
    // 业务规则: 城市名称不可重复（大小写不敏感匹配，但存储保留原文）
    // 来源: venue.md §4 添加城市 - 业务规则 bullet 2
    // Note: This is relevant for city names that may have Latin characters
    repo.findCityByName.mockResolvedValue(createCityRecord({ name: 'Beijing' }));

    const input: CreateCityInput = { name: 'beijing' };

    await expect(service.createCity(input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'VENUE_CITY_DUPLICATE',
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw VENUE_INVALID_CITY_NAME when city name is empty', async () => {
    // 错误码: VENUE_INVALID_CITY_NAME — 城市名称为空
    // 来源: venue.md §4 添加城市 - 错误码
    const input: CreateCityInput = { name: '' };

    await expect(service.createCity(input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_CITY_NAME',
    });
  });

  it('should throw VENUE_INVALID_CITY_NAME when city name is only whitespace', async () => {
    // 错误码: VENUE_INVALID_CITY_NAME — 城市名称为空
    // 来源: venue.md §4 添加城市 - 错误码
    const input: CreateCityInput = { name: '   ' };

    await expect(service.createCity(input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_CITY_NAME',
    });
  });

  it('should throw VENUE_CITY_DUPLICATE when city name already exists', async () => {
    // 错误码: VENUE_CITY_DUPLICATE — 城市名称已存在
    // 来源: venue.md §4 添加城市 - 错误码
    repo.findCityByName.mockResolvedValue(createCityRecord({ name: '北京' }));

    const input: CreateCityInput = { name: '北京' };

    await expect(service.createCity(input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'VENUE_CITY_DUPLICATE',
    });
  });
});

// ===========================================================================
// GET /api/admin/cities — VenueService.getCityList
// ===========================================================================

describe('GET /api/admin/cities — VenueService.getCityList', () => {
  let service: VenueService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new VenueService(repo as unknown as VenueRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return paginated city list with venueCount', async () => {
    // 业务规则: 获取城市列表（包含每个城市的球馆数量）
    // 来源: venue.md §4 城市列表 - Response 200
    const cities = [
      { ...createCityRecord({ id: 'c1', name: '北京' }), venueCount: 42 },
      { ...createCityRecord({ id: 'c2', name: '上海' }), venueCount: 35 },
    ];
    repo.findCities.mockResolvedValue({ items: cities, total: 2 });

    const query: AdminCityListQuery = { page: 1, pageSize: 20 };
    const result = await service.getCityList(query);

    expect(result).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'c1', name: '北京', venueCount: 42 }),
        expect.objectContaining({ id: 'c2', name: '上海', venueCount: 35 }),
      ]),
      total: 2,
      page: 1,
      pageSize: 20,
    });
  });

  it('should use default pagination when page and pageSize are not specified', async () => {
    // 业务规则: page 默认 1，pageSize 默认 20
    // 来源: venue.md §4 城市列表 - Query Params
    repo.findCities.mockResolvedValue({ items: [], total: 0 });

    const query: AdminCityListQuery = {};
    const result = await service.getCityList(query);

    expect(result).toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });

  it('should calculate venueCount in real-time', async () => {
    // 业务规则: venueCount 为该城市下的球馆数量（实时计算）
    // 来源: venue.md §4 城市列表 - 业务规则 bullet 2
    const cities = [{ ...createCityRecord({ id: 'c1', name: '北京' }), venueCount: 10 }];
    repo.findCities.mockResolvedValue({ items: cities, total: 1 });

    const query: AdminCityListQuery = { page: 1, pageSize: 20 };
    const result = await service.getCityList(query);

    expect(result.items[0]).toHaveProperty('venueCount');
    expect(typeof result.items[0].venueCount).toBe('number');
  });

  it('should sort cities by createdAt descending', async () => {
    // 业务规则: 按创建时间倒序排列
    // 来源: venue.md §4 城市列表 - 业务规则 bullet 3
    const cities = [
      {
        ...createCityRecord({
          id: 'c1',
          name: '上海',
          createdAt: new Date('2026-04-02T10:00:00.000Z'),
        }),
        venueCount: 35,
      },
      {
        ...createCityRecord({
          id: 'c2',
          name: '北京',
          createdAt: new Date('2026-04-01T10:00:00.000Z'),
        }),
        venueCount: 42,
      },
    ];
    repo.findCities.mockResolvedValue({ items: cities, total: 2 });

    const query: AdminCityListQuery = { page: 1, pageSize: 20 };
    const result = await service.getCityList(query);

    // First item should have later createdAt (descending order)
    expect(result.items[0].name).toBe('上海');
    expect(result.items[1].name).toBe('北京');
  });

  it('should cap pageSize to 100 when value exceeds maximum', async () => {
    // 业务规则: pageSize 最大 100
    // 来源: venue.md §4 城市列表 - Query Params (每页条数，默认 20，最大 100)
    repo.findCities.mockResolvedValue({ items: [], total: 0 });

    const query: AdminCityListQuery = { page: 1, pageSize: 200 };
    const result = await service.getCityList(query);

    expect(result.pageSize).toBe(100);
  });

  it('should return empty list when no cities exist', async () => {
    // 业务规则: 空列表场景
    // 来源: venue.md §4 城市列表 - Response 200
    repo.findCities.mockResolvedValue({ items: [], total: 0 });

    const query: AdminCityListQuery = { page: 1, pageSize: 20 };
    const result = await service.getCityList(query);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ===========================================================================
// GET /api/admin/venues — VenueService.getAdminVenueList
// ===========================================================================

describe('GET /api/admin/venues — VenueService.getAdminVenueList', () => {
  let service: VenueService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new VenueService(repo as unknown as VenueRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return paginated venue list with cityName', async () => {
    // 业务规则: 获取球馆列表，返回球馆所属城市名称
    // 来源: venue.md §4 球馆列表 - Response 200 + 业务规则 bullet 4
    const venues = [
      createAdminVenueRecord({ id: 'v1' }),
      createAdminVenueRecord({ id: 'v2', name: '海淀羽毛球馆', cityName: '北京' }),
    ];
    repo.findAdminVenues.mockResolvedValue({ items: venues, total: 2 });

    const query: AdminVenueListQuery = { page: 1, pageSize: 20 };
    const result = await service.getAdminVenueList(query);

    expect(result).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'v1', cityName: '北京' }),
        expect.objectContaining({ id: 'v2', cityName: '北京' }),
      ]),
      total: 2,
      page: 1,
      pageSize: 20,
    });
  });

  it('should filter venues by cityId when provided', async () => {
    // 业务规则: 支持按城市 ID 筛选
    // 来源: venue.md §4 球馆列表 - 业务规则 bullet 2
    repo.findAdminVenues.mockResolvedValue({ items: [], total: 0 });

    const query: AdminVenueListQuery = { cityId: 'city-uuid-1', page: 1, pageSize: 20 };
    await service.getAdminVenueList(query);

    expect(repo.findAdminVenues).toHaveBeenCalledTimes(1);
    const callArgs = repo.findAdminVenues.mock.calls[0][0];
    expect(callArgs).toMatchObject({ cityId: 'city-uuid-1' });
  });

  it('should filter venues by keyword when provided', async () => {
    // 业务规则: 支持按名称关键词模糊搜索
    // 来源: venue.md §4 球馆列表 - 业务规则 bullet 2
    repo.findAdminVenues.mockResolvedValue({ items: [], total: 0 });

    const query: AdminVenueListQuery = { keyword: '朝阳', page: 1, pageSize: 20 };
    await service.getAdminVenueList(query);

    expect(repo.findAdminVenues).toHaveBeenCalledTimes(1);
    const callArgs = repo.findAdminVenues.mock.calls[0][0];
    expect(callArgs).toMatchObject({ keyword: '朝阳' });
  });

  it('should support combined filtering by cityId and keyword', async () => {
    // 业务规则: 两个筛选条件可组合
    // 来源: venue.md §4 球馆列表 - 业务规则 bullet 2
    repo.findAdminVenues.mockResolvedValue({ items: [], total: 0 });

    const query: AdminVenueListQuery = {
      cityId: 'city-uuid-1',
      keyword: '朝阳',
      page: 1,
      pageSize: 20,
    };
    await service.getAdminVenueList(query);

    expect(repo.findAdminVenues).toHaveBeenCalledTimes(1);
    const callArgs = repo.findAdminVenues.mock.calls[0][0];
    expect(callArgs).toMatchObject({ cityId: 'city-uuid-1', keyword: '朝阳' });
  });

  it('should use default pagination when not specified', async () => {
    // 业务规则: page 默认 1，pageSize 默认 20
    // 来源: venue.md §4 球馆列表 - Query Params
    repo.findAdminVenues.mockResolvedValue({ items: [], total: 0 });

    const query: AdminVenueListQuery = {};
    const result = await service.getAdminVenueList(query);

    expect(result).toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });

  it('should sort venues by createdAt descending', async () => {
    // 业务规则: 按创建时间倒序排列
    // 来源: venue.md §4 球馆列表 - 业务规则 bullet 3
    const venues = [
      createAdminVenueRecord({
        id: 'v1',
        name: '新球馆',
        createdAt: new Date('2026-04-02T10:00:00.000Z'),
      }),
      createAdminVenueRecord({
        id: 'v2',
        name: '旧球馆',
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
      }),
    ];
    repo.findAdminVenues.mockResolvedValue({ items: venues, total: 2 });

    const query: AdminVenueListQuery = { page: 1, pageSize: 20 };
    const result = await service.getAdminVenueList(query);

    expect(result.items[0].name).toBe('新球馆');
    expect(result.items[1].name).toBe('旧球馆');
  });

  it('should cap pageSize to 100 when value exceeds maximum', async () => {
    // 业务规则: pageSize 最大 100
    // 来源: venue.md §4 球馆列表 - Query Params (每页条数，默认 20，最大 100)
    repo.findAdminVenues.mockResolvedValue({ items: [], total: 0 });

    const query: AdminVenueListQuery = { page: 1, pageSize: 200 };
    const result = await service.getAdminVenueList(query);

    expect(result.pageSize).toBe(100);
  });

  it('should return empty list when no venues match', async () => {
    // 业务规则: 空列表场景
    // 来源: venue.md §4 球馆列表 - Response 200
    repo.findAdminVenues.mockResolvedValue({ items: [], total: 0 });

    const query: AdminVenueListQuery = { keyword: '不存在的球馆' };
    const result = await service.getAdminVenueList(query);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ===========================================================================
// DELETE /api/admin/venues/:id — VenueService.deleteVenue
// ===========================================================================

describe('DELETE /api/admin/venues/:id — VenueService.deleteVenue', () => {
  let service: VenueService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new VenueService(repo as unknown as VenueRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should delete venue and return success message', async () => {
    // 业务规则: 物理删除球馆记录
    // 来源: venue.md §4 移除球馆 - Response 200 + 业务规则 bullet 2
    repo.findVenueById.mockResolvedValue({
      id: 'venue-uuid-1',
      name: '朝阳体育中心羽毛球馆',
    });
    repo.deleteVenue.mockResolvedValue(undefined);

    const result = await service.deleteVenue('venue-uuid-1');

    expect(result).toMatchObject({
      message: '球馆已移除',
    });
  });

  it('should call repository to check venue existence before deleting', async () => {
    // 业务规则: 球馆不存在时返回 404
    // 来源: venue.md §4 移除球馆 - 错误码
    repo.findVenueById.mockResolvedValue({
      id: 'venue-uuid-1',
      name: '朝阳体育中心羽毛球馆',
    });
    repo.deleteVenue.mockResolvedValue(undefined);

    await service.deleteVenue('venue-uuid-1');

    expect(repo.findVenueById).toHaveBeenCalledWith('venue-uuid-1');
    expect(repo.deleteVenue).toHaveBeenCalledWith('venue-uuid-1');
  });

  it('should physically delete the venue record', async () => {
    // 业务规则: 物理删除球馆记录（非软删除）
    // 来源: venue.md §4 移除球馆 - 业务规则 bullet 2
    repo.findVenueById.mockResolvedValue({
      id: 'venue-uuid-1',
      name: '球馆A',
    });
    repo.deleteVenue.mockResolvedValue(undefined);

    await service.deleteVenue('venue-uuid-1');

    expect(repo.deleteVenue).toHaveBeenCalledWith('venue-uuid-1');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw VENUE_NOT_FOUND when venue does not exist', async () => {
    // 错误码: VENUE_NOT_FOUND — 球馆不存在
    // 来源: venue.md §4 移除球馆 - 错误码
    repo.findVenueById.mockResolvedValue(null);

    await expect(service.deleteVenue('nonexistent-uuid')).rejects.toMatchObject({
      statusCode: 404,
      code: 'VENUE_NOT_FOUND',
    });
  });

  it('should not call deleteVenue in repository when venue does not exist', async () => {
    // 业务规则: 不应尝试删除不存在的记录
    // 来源: venue.md §4 移除球馆 - 隐含逻辑
    repo.findVenueById.mockResolvedValue(null);

    try {
      await service.deleteVenue('nonexistent-uuid');
    } catch {
      // Expected to throw
    }

    expect(repo.deleteVenue).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// POST /api/admin/venues/sync — VenueService.syncVenues
// ===========================================================================

describe('POST /api/admin/venues/sync — VenueService.syncVenues', () => {
  let service: VenueService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new VenueService(repo as unknown as VenueRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return sync results for all cities', async () => {
    // 业务规则: 对所有城市调用地图服务，更新球馆数据
    // 来源: venue.md §4 手动触发球馆数据更新 - Response 200
    repo.getAllCities.mockResolvedValue([
      createCityRecord({ id: 'c1', name: '北京' }),
      createCityRecord({ id: 'c2', name: '上海' }),
    ]);

    const result = await service.syncVenues();

    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('syncResults');
    expect(Array.isArray(result.syncResults)).toBe(true);
  });

  it('should include city info and venue counts in each sync result', async () => {
    // 业务规则: 返回每个城市的同步结果
    // 来源: venue.md §4 手动触发球馆数据更新 - Response 200 syncResults
    repo.getAllCities.mockResolvedValue([createCityRecord({ id: 'c1', name: '北京' })]);

    const result = await service.syncVenues();

    // S3 fix: 先断言非空，再验证字段，避免空数组时静默通过
    expect(result.syncResults.length).toBeGreaterThan(0);
    const syncResult = result.syncResults[0];
    expect(syncResult).toHaveProperty('cityId');
    expect(syncResult).toHaveProperty('cityName');
    expect(syncResult).toHaveProperty('newVenues');
    expect(syncResult).toHaveProperty('updatedVenues');
    expect(syncResult).toHaveProperty('totalVenues');
  });

  it('should sync all cities (not just one)', async () => {
    // 业务规则: 对所有城市调用地图服务
    // 来源: venue.md §4 手动触发球馆数据更新 - 业务规则 bullet 2
    repo.getAllCities.mockResolvedValue([
      createCityRecord({ id: 'c1', name: '北京' }),
      createCityRecord({ id: 'c2', name: '上海' }),
      createCityRecord({ id: 'c3', name: '广州' }),
    ]);

    const result = await service.syncVenues();

    // S1 fix: 断言 syncResults 长度与城市数一致，验证所有城市都被同步
    expect(result.syncResults).toHaveLength(3);
    // 同时验证 upsertVenues 对每个城市都调用了一次
    expect(repo.upsertVenues).toHaveBeenCalledTimes(3);
  });

  it('should continue syncing other cities when one city fails', async () => {
    // 业务规则: 某个城市的同步失败不影响其他城市的同步
    // 来源: venue.md §4 手动触发球馆数据更新 - 业务规则 bullet 5
    repo.getAllCities.mockResolvedValue([
      createCityRecord({ id: 'c1', name: '北京' }),
      createCityRecord({ id: 'c2', name: '上海' }),
    ]);

    // S2 fix: 模拟第一个城市同步失败（地图服务不可用）
    repo.upsertVenues
      .mockRejectedValueOnce(new Error('Map service unavailable for 北京'))
      .mockResolvedValueOnce(undefined);

    // 即使一个城市失败，整体不应 reject
    const result = await service.syncVenues();

    expect(result).toHaveProperty('syncResults');
    // syncResults 应包含所有城市的结果（包括失败的）
    expect(result.syncResults).toHaveLength(2);
    // upsertVenues 应对两个城市都被调用
    expect(repo.upsertVenues).toHaveBeenCalledTimes(2);
  });

  it('should use mapPoiId for deduplication during sync', async () => {
    // 业务规则: 通过 mapPoiId 去重，已存在的更新名称和地址，不存在的新增
    // 来源: venue.md §4 手动触发球馆数据更新 - 业务规则 bullet 4
    repo.getAllCities.mockResolvedValue([createCityRecord({ id: 'c1', name: '北京' })]);

    await service.syncVenues();

    // upsertVenues should be called for deduplication-based upsert
    expect(repo.upsertVenues).toHaveBeenCalled();
    // upsertVenues should receive the city ID for the synced city
    const callArgs = repo.upsertVenues.mock.calls[0];
    expect(callArgs[0]).toBe('c1');
  });

  it('should not auto-delete venues that are no longer in map service results', async () => {
    // 业务规则: 已关闭球馆不自动删除（由管理员手动处理）
    // 来源: venue.md §4 手动触发球馆数据更新 - 业务规则 bullet 4 + §6.2 步骤 4c
    repo.getAllCities.mockResolvedValue([createCityRecord({ id: 'c1', name: '北京' })]);

    await service.syncVenues();

    // deleteVenue should NOT be called during sync
    expect(repo.deleteVenue).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 并发控制 (内存锁)
  // -----------------------------------------------------------------------

  it('should throw VENUE_SYNC_IN_PROGRESS when a sync is already running', async () => {
    // 错误码: VENUE_SYNC_IN_PROGRESS — 上一次同步尚未完成
    // 来源: venue.md §4 手动触发球馆数据更新 - 错误码 + §6.4 并发控制
    let resolveFirst!: (value: unknown) => void;
    const blockingPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    // Simulate a long-running sync by making getAllCities block
    repo.getAllCities.mockImplementation(() =>
      blockingPromise.then(() => [createCityRecord({ id: 'c1', name: '北京' })]),
    );

    // Start first sync (don't await — it's blocked)
    const firstSync = service.syncVenues().catch(() => {
      // Suppress unhandled rejection from stub "Not implemented"
    });

    // Try to start second sync immediately — should be rejected
    await expect(service.syncVenues()).rejects.toMatchObject({
      statusCode: 409,
      code: 'VENUE_SYNC_IN_PROGRESS',
    });

    // Release the blocking promise and clean up
    resolveFirst(undefined);
    await firstSync;
  });

  it('should release the sync lock after successful completion', async () => {
    // 业务规则: 完成后释放内存锁
    // 来源: venue.md §6.4 并发控制
    repo.getAllCities.mockResolvedValue([createCityRecord({ id: 'c1', name: '北京' })]);

    // First sync should succeed
    await service.syncVenues();

    // Second sync should also succeed (lock released)
    await expect(service.syncVenues()).resolves.toBeDefined();
  });

  it('should release the sync lock even when sync fails', async () => {
    // 业务规则: 完成后设回 false（即使有错误也应释放）
    // 来源: venue.md §6.4 并发控制
    repo.getAllCities.mockRejectedValueOnce(new Error('Database error'));

    // First sync may fail
    try {
      await service.syncVenues();
    } catch {
      // Expected
    }

    // Second sync should not be blocked by the lock
    repo.getAllCities.mockResolvedValue([]);
    await expect(service.syncVenues()).resolves.toBeDefined();
  });

  it('should return empty syncResults when no cities exist', async () => {
    // 业务规则: 无城市时返回空同步结果
    // 来源: venue.md §4 手动触发球馆数据更新 - Response 200
    repo.getAllCities.mockResolvedValue([]);

    const result = await service.syncVenues();

    expect(result.message).toBeDefined();
    expect(result.syncResults).toEqual([]);
  });
});
