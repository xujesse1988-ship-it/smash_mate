/**
 * L1 集成测试: activity 模块 — 活动创建、列表查询与详情
 *
 * 测试层级: Controller → Service → Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（activity 依赖的 user、venue、notification 模块均已实现并可用）
 *
 * 覆盖接口:
 * - POST /api/activities (创建活动)
 * - GET /api/activities (活动列表)
 * - GET /api/activities/:id (活动详情)
 * - GET /api/users/:id/activities (用户参与的活动列表)
 * - ActivityService.getActivityById (跨模块 Service 调用)
 * - ActivityService.getParticipantIds (跨模块 Service 调用)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { ActivityService } from '@server/modules/activity/service.js';
import { ActivityRepository } from '@server/modules/activity/repository.js';
import { VenueService } from '@server/modules/venue/service.js';
import { VenueRepository } from '@server/modules/venue/repository.js';
import { UserService } from '@server/modules/user/service.js';
import { UserRepository } from '@server/modules/user/repository.js';
import { NotificationService } from '@server/modules/notification/service.js';
import { NotificationRepository } from '@server/modules/notification/repository.js';
import { createTestUser } from '@tests/fixtures/user.js';
import { createTestCity, createTestVenue } from '@tests/fixtures/venue.js';
import { createTestActivity, addTestParticipant, getTestPrisma } from '@tests/fixtures/activity.js';
import { resetTestDatabase } from '@tests/fixtures/database.js';

const prisma = getTestPrisma();

/**
 * Helper: create a JWT token for a given user ID
 */
function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

/**
 * Helper: future date ISO string
 */
function futureDate(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

beforeAll(async () => {
  await resetTestDatabase();
});

afterEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ===========================================================================
// POST /api/activities — 创建活动
// ===========================================================================

describe('POST /api/activities', () => {
  it('should create an activity and return it with creator as first participant', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      name: '朝阳体育中心',
      cityId: city.id,
      mapPoiId: 'poi-create-1',
    });

    const res = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 8,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.currentParticipants).toBe(1);
    expect(res.body.data.creatorId).toBe(user.id);
    expect(res.body.data.venue).toBeDefined();
    expect(res.body.data.venue.id).toBe(venue.id);
    expect(res.body.data.participants).toHaveLength(1);
    expect(res.body.data.participants[0].userId).toBe(user.id);
  });

  it('should allow creating activity with optional title', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-create-title-1' });

    const res = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venueId: venue.id,
        title: '周末约球',
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 4,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('周末约球');
  });

  it('should return 404 when venue does not exist', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venueId: '00000000-0000-0000-0000-000000000000',
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 8,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ACTIVITY_VENUE_NOT_FOUND');
  });

  it('should return 400 when startTime is in the past', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-create-past-1' });

    const res = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venueId: venue.id,
        startTime: '2020-01-01T00:00:00.000Z',
        endTime: futureDate(26),
        maxParticipants: 8,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ACTIVITY_INVALID_TIME');
  });

  it('should return 400 when maxParticipants is out of range', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-create-mp-1' });

    const res = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ACTIVITY_INVALID_PARTICIPANTS');
  });

  it('should return 400 when title exceeds 50 characters', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-create-title-long' });

    const res = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        venueId: venue.id,
        title: 'a'.repeat(51),
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 8,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ACTIVITY_INVALID_TITLE');
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({
        venueId: 'some-id',
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 8,
      });

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/activities — 活动列表
// ===========================================================================

describe('GET /api/activities', () => {
  it('should return future non-cancelled activities', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-list-1' });

    // Create future activity
    await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    });

    const res = await request(app).get('/api/activities').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(20);
  });

  it('should return pagination info', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-list-page-1' });

    // Create multiple activities
    for (let i = 0; i < 3; i++) {
      await createTestActivity({
        creatorId: user.id,
        venueId: venue.id,
        startTime: new Date(Date.now() + (48 + i * 2) * 60 * 60 * 1000),
        endTime: new Date(Date.now() + (50 + i * 2) * 60 * 60 * 1000),
      });
    }

    const res = await request(app)
      .get('/api/activities')
      .query({ page: 1, pageSize: 2 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(2);
  });

  it('should include venue info in list items', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      name: '测试球馆',
      cityId: city.id,
      mapPoiId: 'poi-list-venue-1',
    });

    await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    });

    const res = await request(app).get('/api/activities').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const item = res.body.data.items[0];
    expect(item.venue).toBeDefined();
    expect(item.venue.id).toBe(venue.id);
    expect(item.venue.name).toBe('测试球馆');
  });

  it('should not return cancelled activities by default', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-list-cancel-1' });

    // Create a cancelled activity
    await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      status: 'cancelled',
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    });

    const res = await request(app).get('/api/activities').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('should filter by hasSlot=true to only show open activities', async () => {
    const user = await createTestUser();
    const user2 = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-list-slot-1' });

    // Create open activity
    await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      status: 'open',
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    });

    // Create full activity
    await createTestActivity({
      creatorId: user2.id,
      venueId: venue.id,
      status: 'full',
      maxParticipants: 2,
      startTime: new Date(Date.now() + 52 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 54 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get('/api/activities')
      .query({ hasSlot: true })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe('open');
  });

  it('should include distance when coordinates are provided', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      latitude: 39.92,
      longitude: 116.44,
      mapPoiId: 'poi-list-dist-1',
    });

    await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get('/api/activities')
      .query({ latitude: 39.9, longitude: 116.4 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(typeof res.body.data.items[0].distance).toBe('number');
  });

  it('should return 400 when only latitude is provided', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/activities')
      .query({ latitude: 39.9 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ACTIVITY_INVALID_COORDINATES');
  });

  it('should return 400 when dateStart is provided without dateEnd', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/activities')
      .query({ dateStart: '2026-04-05T00:00:00.000Z' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ACTIVITY_INVALID_DATE_RANGE');
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/activities');

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/activities/:id — 活动详情
// ===========================================================================

describe('GET /api/activities/:id', () => {
  it('should return activity detail with participants and creator info', async () => {
    const user = await createTestUser({ nickname: '发起者' });
    const user2 = await createTestUser({ nickname: '参与者' });
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      name: '测试详情球馆',
      cityId: city.id,
      mapPoiId: 'poi-detail-1',
    });

    const activity = await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    });
    await addTestParticipant(activity.id, user2.id);

    const res = await request(app)
      .get(`/api/activities/${activity.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(activity.id);
    expect(res.body.data.creatorId).toBe(user.id);
    expect(res.body.data.currentParticipants).toBe(2);
    expect(res.body.data.venue).toBeDefined();
    expect(res.body.data.venue.name).toBe('测试详情球馆');
    expect(res.body.data.creator).toBeDefined();
    expect(res.body.data.creator.nickname).toBe('发起者');
    expect(res.body.data.participants).toHaveLength(2);
    // Participants should include userId, nickname, joinedAt
    const participant = res.body.data.participants.find(
      (p: { userId: string }) => p.userId === user2.id,
    );
    expect(participant).toBeDefined();
    expect(participant.nickname).toBe('参与者');
    expect(participant.joinedAt).toBeDefined();
  });

  it('should return detail for cancelled or completed activities', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-detail-cancel-1' });

    const activity = await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      status: 'cancelled',
    });

    const res = await request(app)
      .get(`/api/activities/${activity.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('should return 404 when activity does not exist', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/activities/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ACTIVITY_NOT_FOUND');
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/activities/some-id');

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/users/:id/activities — 用户参与的活动列表
// ===========================================================================

describe('GET /api/users/:id/activities', () => {
  it('should return activities for a specific user', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-user-act-1' });

    await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
    });

    const res = await request(app)
      .get(`/api/users/${user.id}/activities`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('should return empty list for non-existent user', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/users/00000000-0000-0000-0000-000000000000/activities')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it('should filter by role=creator', async () => {
    const creator = await createTestUser();
    const participant = await createTestUser();
    const token = signToken(participant.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-user-role-1' });

    // Activity created by creator, participant joins
    const activity = await createTestActivity({
      creatorId: creator.id,
      venueId: venue.id,
    });
    await addTestParticipant(activity.id, participant.id);

    // Activity created by participant
    await createTestActivity({
      creatorId: participant.id,
      venueId: venue.id,
      startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 74 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get(`/api/users/${participant.id}/activities`)
      .query({ role: 'creator' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].creatorId).toBe(participant.id);
  });

  it('should filter by status', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-user-status-1' });

    await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      status: 'open',
    });
    await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
      status: 'completed',
      startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 74 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get(`/api/users/${user.id}/activities`)
      .query({ status: 'open' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe('open');
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/users/some-id/activities');

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// Cross-module: ActivityService.getActivityById
// ===========================================================================

describe('ActivityService.getActivityById — cross-module', () => {
  let service: ActivityService;

  beforeAll(() => {
    const activityRepo = new ActivityRepository();
    const venueService = new VenueService(new VenueRepository());
    const userService = new UserService(new UserRepository());
    const notificationService = new NotificationService(new NotificationRepository());
    service = new ActivityService(activityRepo, venueService, userService, notificationService);
  });

  it('should return activity info when activity exists', async () => {
    const user = await createTestUser();
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-cross-act-1' });

    const activity = await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
    });

    const result = await service.getActivityById(activity.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(activity.id);
    expect(result!.creatorId).toBe(user.id);
    expect(result!.venueId).toBe(venue.id);
    expect(result!.startTime).toBeDefined();
    expect(result!.endTime).toBeDefined();
    expect(result!.status).toBeDefined();
  });

  it('should return null when activity does not exist', async () => {
    const result = await service.getActivityById('00000000-0000-0000-0000-000000000000');

    expect(result).toBeNull();
  });
});

// ===========================================================================
// Cross-module: ActivityService.getParticipantIds
// ===========================================================================

describe('ActivityService.getParticipantIds — cross-module', () => {
  let service: ActivityService;

  beforeAll(() => {
    const activityRepo = new ActivityRepository();
    const venueService = new VenueService(new VenueRepository());
    const userService = new UserService(new UserRepository());
    const notificationService = new NotificationService(new NotificationRepository());
    service = new ActivityService(activityRepo, venueService, userService, notificationService);
  });

  it('should return participant IDs including creator', async () => {
    const user = await createTestUser();
    const user2 = await createTestUser();
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-cross-part-1' });

    const activity = await createTestActivity({
      creatorId: user.id,
      venueId: venue.id,
    });
    await addTestParticipant(activity.id, user2.id);

    const result = await service.getParticipantIds(activity.id);

    expect(result).toHaveLength(2);
    expect(result).toContain(user.id);
    expect(result).toContain(user2.id);
  });

  it('should return empty array when activity does not exist', async () => {
    const result = await service.getParticipantIds('00000000-0000-0000-0000-000000000000');

    expect(result).toEqual([]);
  });
});
