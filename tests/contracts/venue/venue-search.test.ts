/**
 * 契约测试: venue 模块 — 球馆搜索与详情接口
 * 覆盖接口:
 *   - GET /api/venues/search (VenueService.searchVenues)
 *   - GET /api/venues/:id (VenueService.getVenueDetail)
 *   - VenueService.getVenueById (跨模块 Service 调用)
 *
 * 来源文档: docs/module-design/venue.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - VenueRepository: 全部 mock（隔离数据库依赖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VenueService } from '@server/modules/venue/service.js';
import { VenueRepository } from '@server/modules/venue/repository.js';
import type { VenueSearchQuery } from '@server/modules/venue/types.js';

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
    createCity: vi.fn().mockResolvedValue(null),
    findCityByName: vi.fn().mockResolvedValue(null),
    findCities: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findAdminVenues: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    deleteVenue: vi.fn().mockResolvedValue(undefined),
    upsertVenues: vi.fn().mockResolvedValue(undefined),
    getAllCities: vi.fn().mockResolvedValue([]),
  };
}

/** Standard venue record as returned by repository (with city info) */
function createVenueRecord(overrides?: Partial<{
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  cityId: string;
  mapPoiId: string;
  createdAt: Date;
  updatedAt: Date;
  city: { name: string };
}>) {
  return {
    id: 'venue-uuid-1',
    name: '朝阳体育中心羽毛球馆',
    address: '北京市朝阳区朝阳公园南路1号',
    latitude: 39.9215,
    longitude: 116.4435,
    cityId: 'city-uuid-1',
    mapPoiId: 'poi-001',
    createdAt: new Date('2026-04-01T10:00:00.000Z'),
    updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    city: { name: '北京' },
    ...overrides,
  };
}

/** Standard search result item as returned by repository */
function createSearchResultItem(overrides?: Partial<{
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  cityName: string;
  distance: number | null;
}>) {
  return {
    id: 'venue-uuid-1',
    name: '朝阳体育中心羽毛球馆',
    address: '北京市朝阳区朝阳公园南路1号',
    latitude: 39.9215,
    longitude: 116.4435,
    cityName: '北京',
    distance: null,
    ...overrides,
  };
}

// ===========================================================================
// GET /api/venues/search — VenueService.searchVenues
// ===========================================================================

describe('GET /api/venues/search — VenueService.searchVenues', () => {
  let service: VenueService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new VenueService(repo as unknown as VenueRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return matching venues when keyword is provided', async () => {
    // 业务规则: keyword 按球馆名称进行模糊匹配
    // 来源: venue.md §4 球馆搜索 - 业务规则 bullet 2
    const items = [
      createSearchResultItem({ id: 'v1', name: '朝阳体育中心羽毛球馆' }),
      createSearchResultItem({ id: 'v2', name: '海淀羽毛球馆' }),
    ];
    repo.searchVenues.mockResolvedValue(items);

    const query: VenueSearchQuery = { keyword: '羽毛球' };
    const result = await service.searchVenues(query);

    expect(result).toEqual({ items });
    expect(repo.searchVenues).toHaveBeenCalledTimes(1);
  });

  it('should pass keyword to repository for fuzzy matching', async () => {
    // 业务规则: keyword 按球馆名称进行模糊匹配（LIKE '%keyword%'）
    // 来源: venue.md §4 球馆搜索 - 业务规则 bullet 2
    repo.searchVenues.mockResolvedValue([]);

    const query: VenueSearchQuery = { keyword: '体育' };
    await service.searchVenues(query);

    const callArgs = repo.searchVenues.mock.calls[0];
    // Verify keyword is passed to repository
    expect(callArgs).toBeDefined();
  });

  it('should include distance field when latitude and longitude are provided', async () => {
    // 业务规则: 当 latitude 和 longitude 都提供时，按直线距离（Haversine 公式）升序排序
    // 来源: venue.md §4 球馆搜索 - 业务规则 bullet 3
    const items = [
      createSearchResultItem({ id: 'v1', distance: 1.2 }),
      createSearchResultItem({ id: 'v2', distance: 3.5 }),
    ];
    repo.searchVenues.mockResolvedValue(items);

    const query: VenueSearchQuery = {
      keyword: '羽毛球',
      latitude: 39.9,
      longitude: 116.4,
    };
    const result = await service.searchVenues(query);

    expect(result.items[0].distance).toBe(1.2);
    expect(result.items[1].distance).toBe(3.5);
  });

  it('should not include distance field when coordinates are not provided', async () => {
    // 业务规则: 未传入经纬度时 distance 字段不返回
    // 来源: venue.md §4 球馆搜索 - Response 200 注释
    const items = [
      createSearchResultItem({ id: 'v1', distance: null }),
    ];
    repo.searchVenues.mockResolvedValue(items);

    const query: VenueSearchQuery = { keyword: '羽毛球' };
    const result = await service.searchVenues(query);

    // distance should be null or undefined (not returned) when no coordinates
    expect(result.items[0].distance).toBeNull();
  });

  it('should sort by name when coordinates are not provided', async () => {
    // 业务规则: 当 latitude 和 longitude 未提供时，按球馆名称排序
    // 来源: venue.md §4 球馆搜索 - 业务规则 bullet 4
    repo.searchVenues.mockResolvedValue([]);

    const query: VenueSearchQuery = { keyword: '球馆' };
    await service.searchVenues(query);

    // Verify coordinates not passed (so repo should sort by name)
    const callArgs = repo.searchVenues.mock.calls[0];
    expect(callArgs).toBeDefined();
  });

  it('should use default limit of 10 when not specified', async () => {
    // 业务规则: limit 参数默认 10
    // 来源: venue.md §4 球馆搜索 - Query Params (limit 默认 10)
    repo.searchVenues.mockResolvedValue([]);

    const query: VenueSearchQuery = { keyword: '球馆' };
    await service.searchVenues(query);

    // Verify default limit is applied (10)
    const callArgs = repo.searchVenues.mock.calls[0];
    expect(callArgs).toBeDefined();
  });

  it('should cap limit to 50 when value exceeds maximum', async () => {
    // 业务规则: limit 参数超出范围时取默认值（大于 50 取 50）
    // 来源: venue.md §4 球馆搜索 - 业务规则 bullet 6
    repo.searchVenues.mockResolvedValue([]);

    const query: VenueSearchQuery = { keyword: '球馆', limit: 100 };
    await service.searchVenues(query);

    const callArgs = repo.searchVenues.mock.calls[0];
    expect(callArgs).toBeDefined();
  });

  it('should use default limit when value is less than 1', async () => {
    // 业务规则: limit 参数超出范围时取默认值（小于 1 取 10）
    // 来源: venue.md §4 球馆搜索 - 业务规则 bullet 6
    repo.searchVenues.mockResolvedValue([]);

    const query: VenueSearchQuery = { keyword: '球馆', limit: 0 };
    await service.searchVenues(query);

    const callArgs = repo.searchVenues.mock.calls[0];
    expect(callArgs).toBeDefined();
  });

  it('should return cityName with each venue in search results', async () => {
    // 业务规则: 返回 cityName 字段方便前端展示
    // 来源: venue.md §4 球馆搜索 - Response 200 (cityName 字段)
    const items = [
      createSearchResultItem({ cityName: '北京' }),
      createSearchResultItem({ id: 'v2', cityName: '上海' }),
    ];
    repo.searchVenues.mockResolvedValue(items);

    const query: VenueSearchQuery = { keyword: '羽毛球' };
    const result = await service.searchVenues(query);

    expect(result.items[0].cityName).toBe('北京');
    expect(result.items[1].cityName).toBe('上海');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw VENUE_INVALID_KEYWORD when keyword is empty string', async () => {
    // 错误码: VENUE_INVALID_KEYWORD — keyword 为空或缺失
    // 来源: venue.md §4 球馆搜索 - 错误码
    const query: VenueSearchQuery = { keyword: '' };

    await expect(service.searchVenues(query)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_KEYWORD',
    });
  });

  it('should throw VENUE_INVALID_KEYWORD when keyword is only whitespace', async () => {
    // 错误码: VENUE_INVALID_KEYWORD — keyword 为空或缺失
    // 来源: venue.md §4 球馆搜索 - 错误码 + Query Params (最少 1 个字符)
    const query: VenueSearchQuery = { keyword: '   ' };

    await expect(service.searchVenues(query)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_KEYWORD',
    });
  });

  it('should throw VENUE_INVALID_COORDINATES when only latitude is provided', async () => {
    // 错误码: VENUE_INVALID_COORDINATES — 经纬度只提供了一个
    // 来源: venue.md §4 球馆搜索 - 业务规则 bullet 5 + 错误码
    const query: VenueSearchQuery = { keyword: '球馆', latitude: 39.9 };

    await expect(service.searchVenues(query)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_COORDINATES',
    });
  });

  it('should throw VENUE_INVALID_COORDINATES when only longitude is provided', async () => {
    // 错误码: VENUE_INVALID_COORDINATES — 经纬度只提供了一个
    // 来源: venue.md §4 球馆搜索 - 业务规则 bullet 5 + 错误码
    const query: VenueSearchQuery = { keyword: '球馆', longitude: 116.4 };

    await expect(service.searchVenues(query)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_COORDINATES',
    });
  });

  it('should throw VENUE_INVALID_COORDINATES when latitude is out of range (> 90)', async () => {
    // 错误码: VENUE_INVALID_COORDINATES — latitude 超出 -90~90
    // 来源: venue.md §4 球馆搜索 - 错误码
    const query: VenueSearchQuery = {
      keyword: '球馆',
      latitude: 91,
      longitude: 116.4,
    };

    await expect(service.searchVenues(query)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_COORDINATES',
    });
  });

  it('should throw VENUE_INVALID_COORDINATES when latitude is out of range (< -90)', async () => {
    // 错误码: VENUE_INVALID_COORDINATES — latitude 超出 -90~90
    // 来源: venue.md §4 球馆搜索 - 错误码
    const query: VenueSearchQuery = {
      keyword: '球馆',
      latitude: -91,
      longitude: 116.4,
    };

    await expect(service.searchVenues(query)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_COORDINATES',
    });
  });

  it('should throw VENUE_INVALID_COORDINATES when longitude is out of range (> 180)', async () => {
    // 错误码: VENUE_INVALID_COORDINATES — longitude 超出 -180~180
    // 来源: venue.md §4 球馆搜索 - 错误码
    const query: VenueSearchQuery = {
      keyword: '球馆',
      latitude: 39.9,
      longitude: 181,
    };

    await expect(service.searchVenues(query)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_COORDINATES',
    });
  });

  it('should throw VENUE_INVALID_COORDINATES when longitude is out of range (< -180)', async () => {
    // 错误码: VENUE_INVALID_COORDINATES — longitude 超出 -180~180
    // 来源: venue.md §4 球馆搜索 - 错误码
    const query: VenueSearchQuery = {
      keyword: '球馆',
      latitude: 39.9,
      longitude: -181,
    };

    await expect(service.searchVenues(query)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VENUE_INVALID_COORDINATES',
    });
  });
});

// ===========================================================================
// GET /api/venues/:id — VenueService.getVenueDetail
// ===========================================================================

describe('GET /api/venues/:id — VenueService.getVenueDetail', () => {
  let service: VenueService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new VenueService(repo as unknown as VenueRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return venue detail for a valid venue ID', async () => {
    // 业务规则: 任何已登录用户均可查看球馆详情
    // 来源: venue.md §4 球馆详情 - Response 200
    const venue = createVenueRecord();
    repo.findVenueById.mockResolvedValue(venue);

    const result = await service.getVenueDetail('venue-uuid-1');

    expect(result).toMatchObject({
      id: 'venue-uuid-1',
      name: '朝阳体育中心羽毛球馆',
      address: '北京市朝阳区朝阳公园南路1号',
      latitude: 39.9215,
      longitude: 116.4435,
      cityId: 'city-uuid-1',
    });
  });

  it('should call repository with the correct venue ID', async () => {
    // 业务规则: 根据 ID 获取球馆详情
    // 来源: venue.md §4 球馆详情
    const venue = createVenueRecord();
    repo.findVenueById.mockResolvedValue(venue);

    await service.getVenueDetail('venue-uuid-1');

    expect(repo.findVenueById).toHaveBeenCalledWith('venue-uuid-1');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw VENUE_NOT_FOUND when venue does not exist', async () => {
    // 错误码: VENUE_NOT_FOUND — 球馆不存在
    // 来源: venue.md §4 球馆详情 - 错误码
    repo.findVenueById.mockResolvedValue(null);

    await expect(service.getVenueDetail('nonexistent-uuid')).rejects.toMatchObject({
      statusCode: 404,
      code: 'VENUE_NOT_FOUND',
    });
  });
});

// ===========================================================================
// VenueService.getVenueById — 跨模块 Service 调用
// ===========================================================================

describe('VenueService.getVenueById — 跨模块 Service 调用', () => {
  let service: VenueService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new VenueService(repo as unknown as VenueRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return venue info when venue exists', async () => {
    // 业务规则: 根据球馆 ID 获取球馆信息（供其他模块校验球馆存在性或获取球馆信息）
    // 来源: venue.md §4 内部接口 - VenueService.getVenueById
    const venue = createVenueRecord();
    repo.findVenueById.mockResolvedValue(venue);

    const result = await service.getVenueById('venue-uuid-1');

    expect(result).toMatchObject({
      id: 'venue-uuid-1',
      name: '朝阳体育中心羽毛球馆',
      address: '北京市朝阳区朝阳公园南路1号',
      latitude: 39.9215,
      longitude: 116.4435,
    });
  });

  it('should return null when venue does not exist', async () => {
    // 业务规则: 球馆不存在时返回 null（由调用方决定如何处理）
    // 来源: venue.md §4 内部接口 - VenueService.getVenueById - 业务规则
    repo.findVenueById.mockResolvedValue(null);

    const result = await service.getVenueById('nonexistent-uuid');

    expect(result).toBeNull();
  });

  it('should not throw when venue does not exist', async () => {
    // 业务规则: 球馆不存在时返回 null，不抛错
    // 来源: venue.md §4 内部接口 - VenueService.getVenueById - 错误码（无）
    repo.findVenueById.mockResolvedValue(null);

    await expect(service.getVenueById('nonexistent-uuid')).resolves.toBeNull();
  });

  it('should include latitude and longitude in returned info', async () => {
    // 业务规则: 返回字段包含经纬度，供调用方计算距离等场景使用
    // 来源: venue.md §4 内部接口 - VenueService.getVenueById - 返回值
    const venue = createVenueRecord({
      latitude: 31.2304,
      longitude: 121.4737,
    });
    repo.findVenueById.mockResolvedValue(venue);

    const result = await service.getVenueById('venue-uuid-1');

    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(31.2304);
    expect(result!.longitude).toBe(121.4737);
  });
});
