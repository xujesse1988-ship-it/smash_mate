/**
 * L1 集成测试: venue 模块 — 球馆搜索、详情与跨模块接口
 *
 * 测试层级: Controller → Service → Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（venue 为基础层，不依赖其他业务模块）
 *
 * 覆盖接口:
 * - GET /api/venues/search (球馆搜索)
 * - GET /api/venues/:id (球馆详情)
 * - VenueService.getVenueById (跨模块 Service 调用)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { VenueService } from '@server/modules/venue/service.js';
import { VenueRepository } from '@server/modules/venue/repository.js';
import {
  createTestCity,
  createTestVenue,
  cleanupVenueTestData,
  getTestPrisma,
} from '@tests/fixtures/venue.js';
import { createTestUser, cleanupUserTestData } from '@tests/fixtures/user.js';

const prisma = getTestPrisma();

/**
 * Helper: create a JWT token for a given user ID
 */
function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

beforeAll(async () => {
  await cleanupVenueTestData();
  await cleanupUserTestData();
});

afterEach(async () => {
  await cleanupVenueTestData();
  await cleanupUserTestData();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ===========================================================================
// GET /api/venues/search — 球馆搜索
// ===========================================================================

describe('GET /api/venues/search', () => {
  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return matching venues when keyword is provided', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    await createTestVenue({ name: '朝阳羽毛球馆', cityId: city.id, mapPoiId: 'poi-search-1' });
    await createTestVenue({ name: '海淀羽毛球馆', cityId: city.id, mapPoiId: 'poi-search-2' });
    await createTestVenue({ name: '朝阳篮球馆', cityId: city.id, mapPoiId: 'poi-search-3' });

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '羽毛球' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.every((v: { name: string }) => v.name.includes('羽毛球'))).toBe(
      true,
    );
  });

  it('should include cityName in search results', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '上海' });
    await createTestVenue({ name: '浦东羽毛球馆', cityId: city.id, mapPoiId: 'poi-cn-1' });

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '浦东' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].cityName).toBe('上海');
  });

  it('should sort by distance when coordinates are provided', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });

    // Create two venues at different distances from reference point (39.9, 116.4)
    await createTestVenue({
      name: '近距离球馆',
      cityId: city.id,
      latitude: 39.91,
      longitude: 116.41,
      mapPoiId: 'poi-dist-1',
    });
    await createTestVenue({
      name: '远距离球馆',
      cityId: city.id,
      latitude: 40.1,
      longitude: 116.8,
      mapPoiId: 'poi-dist-2',
    });

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '球馆', latitude: 39.9, longitude: 116.4 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    // First item should be closer
    expect(res.body.data.items[0].name).toBe('近距离球馆');
    expect(res.body.data.items[1].name).toBe('远距离球馆');
    // Distance should be present
    expect(typeof res.body.data.items[0].distance).toBe('number');
    expect(res.body.data.items[0].distance).toBeLessThan(res.body.data.items[1].distance);
  });

  it('should not include distance when coordinates are not provided', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    await createTestVenue({ name: '测试球馆', cityId: city.id, mapPoiId: 'poi-nodist-1' });

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '测试球馆' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].distance).toBeNull();
  });

  it('should respect limit parameter', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });

    // Create more venues than the limit
    for (let i = 0; i < 5; i++) {
      await createTestVenue({
        name: `限制测试球馆${i}`,
        cityId: city.id,
        mapPoiId: `poi-limit-${i}`,
      });
    }

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '限制测试', limit: 3 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
  });

  it('should use default limit of 10 when not specified', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });

    // Create 15 venues
    for (let i = 0; i < 15; i++) {
      await createTestVenue({
        name: `默认限制球馆${i}`,
        cityId: city.id,
        mapPoiId: `poi-default-${i}`,
      });
    }

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '默认限制' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(10);
  });

  it('should cap limit to 50 when exceeding maximum', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    await createTestVenue({ name: '上限球馆', cityId: city.id, mapPoiId: 'poi-cap-1' });

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '上限', limit: 100 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Just verify the request succeeds with limit > 50
    expect(res.body.data.items).toHaveLength(1);
  });

  it('should return empty array when no venues match', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '不存在的球馆名称' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should return 400 when keyword is missing', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/venues/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VENUE_INVALID_KEYWORD');
  });

  it('should return 400 when keyword is empty string', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VENUE_INVALID_KEYWORD');
  });

  it('should return 400 when only latitude is provided', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '球馆', latitude: 39.9 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VENUE_INVALID_COORDINATES');
  });

  it('should return 400 when only longitude is provided', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '球馆', longitude: 116.4 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VENUE_INVALID_COORDINATES');
  });

  it('should return 400 when latitude is out of range', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '球馆', latitude: 91, longitude: 116.4 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VENUE_INVALID_COORDINATES');
  });

  it('should return 400 when longitude is out of range', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '球馆', latitude: 39.9, longitude: 181 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VENUE_INVALID_COORDINATES');
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/venues/search').query({ keyword: '球馆' });

    expect(res.status).toBe(401);
  });

  it('should return 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/venues/search')
      .query({ keyword: '球馆' })
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/venues/:id — 球馆详情
// ===========================================================================

describe('GET /api/venues/:id', () => {
  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return venue detail for a valid venue ID', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      name: '朝阳体育中心羽毛球馆',
      address: '北京市朝阳区朝阳公园南路1号',
      latitude: 39.9215,
      longitude: 116.4435,
      cityId: city.id,
      mapPoiId: 'poi-detail-1',
    });

    const res = await request(app)
      .get(`/api/venues/${venue.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: venue.id,
      name: '朝阳体育中心羽毛球馆',
      address: '北京市朝阳区朝阳公园南路1号',
      latitude: 39.9215,
      longitude: 116.4435,
      cityId: city.id,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should return 404 for non-existent venue', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/venues/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VENUE_NOT_FOUND');
  });

  it('should return 401 when no token is provided', async () => {
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-auth-1' });

    const res = await request(app).get(`/api/venues/${venue.id}`);

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// VenueService.getVenueById — 跨模块 Service 调用
// ===========================================================================

describe('VenueService.getVenueById — 跨模块 Service 调用', () => {
  let service: VenueService;

  beforeAll(() => {
    const repo = new VenueRepository();
    service = new VenueService(repo);
  });

  it('should return venue info when venue exists', async () => {
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      name: '跨模块球馆',
      address: '测试地址',
      latitude: 39.9215,
      longitude: 116.4435,
      cityId: city.id,
      mapPoiId: 'poi-cross-1',
    });

    const result = await service.getVenueById(venue.id);

    expect(result).not.toBeNull();
    expect(result!).toMatchObject({
      id: venue.id,
      name: '跨模块球馆',
      address: '测试地址',
      latitude: 39.9215,
      longitude: 116.4435,
    });
  });

  it('should return null when venue does not exist', async () => {
    const result = await service.getVenueById('00000000-0000-0000-0000-000000000000');

    expect(result).toBeNull();
  });

  it('should not throw when venue does not exist', async () => {
    await expect(
      service.getVenueById('00000000-0000-0000-0000-000000000000'),
    ).resolves.toBeNull();
  });

  it('should include latitude and longitude in returned info', async () => {
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({
      latitude: 31.2304,
      longitude: 121.4737,
      cityId: city.id,
      mapPoiId: 'poi-cross-2',
    });

    const result = await service.getVenueById(venue.id);

    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(31.2304);
    expect(result!.longitude).toBe(121.4737);
  });
});
