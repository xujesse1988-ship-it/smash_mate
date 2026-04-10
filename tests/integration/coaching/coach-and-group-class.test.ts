/**
 * L1 集成测试: coaching 模块 — 教练资料管理与团课发布/修改/取消
 *
 * 测试层级: Controller → Service → Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（coaching 依赖的 user、venue、notification 模块均已实现并可用）
 *
 * 覆盖接口:
 * - GET /api/coaches (教练列表)
 * - GET /api/coaches/:id (教练主页)
 * - PUT /api/coaches/me (更新教练资料)
 * - POST /api/group-classes (发布团课)
 * - GET /api/group-classes/:id (团课详情)
 * - PUT /api/group-classes/:id (修改团课)
 * - POST /api/group-classes/:id/cancel (取消团课)
 * - CoachingService.getGroupClassById (跨模块 Service 调用)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';
import { VenueService } from '@server/modules/venue/service.js';
import { VenueRepository } from '@server/modules/venue/repository.js';
import { UserService } from '@server/modules/user/service.js';
import { UserRepository } from '@server/modules/user/repository.js';
import { NotificationService } from '@server/modules/notification/service.js';
import { NotificationRepository } from '@server/modules/notification/repository.js';
import { createTestUser } from '@tests/fixtures/user.js';
import { createTestCity, createTestVenue } from '@tests/fixtures/venue.js';
import {
  createTestCoachProfile,
  createTestGroupClass,
  addTestEnrollment,
  getTestPrisma,
} from '@tests/fixtures/coaching.js';
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

async function cleanupAll() {
  await resetTestDatabase();
}

beforeAll(async () => {
  await cleanupAll();
});

afterEach(async () => {
  await cleanupAll();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ===========================================================================
// PUT /api/coaches/me — 更新教练资料
// ===========================================================================

describe('PUT /api/coaches/me', () => {
  it('should auto-create CoachProfile and update with provided fields', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .put('/api/coaches/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: '10年教学经验',
        specialties: ['singles', 'footwork'],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.userId).toBe(coach.id);
    expect(res.body.data.bio).toBe('10年教学经验');
    expect(res.body.data.specialties).toEqual(['singles', 'footwork']);
  });

  it('should update existing CoachProfile with only provided fields', async () => {
    const coach = await createTestUser({ isCoach: true });
    await createTestCoachProfile({
      userId: coach.id,
      bio: '原始简介',
      specialties: ['singles'],
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .put('/api/coaches/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: '新简介' });

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe('新简介');
    // specialties should remain unchanged
    expect(res.body.data.specialties).toEqual(['singles']);
  });

  it('should reject non-coach user with 403', async () => {
    const user = await createTestUser({ isCoach: false });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/coaches/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'test' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_COACH_ROLE_REQUIRED');
  });

  it('should reject bio exceeding 500 characters', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .put('/api/coaches/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_BIO');
  });

  it('should reject invalid specialty value', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .put('/api/coaches/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialties: ['singles', 'invalid_skill'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_SPECIALTY');
  });

  it('should deduplicate specialties', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .put('/api/coaches/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialties: ['singles', 'singles', 'footwork'] });

    expect(res.status).toBe(200);
    expect(res.body.data.specialties).toHaveLength(2);
  });
});

// ===========================================================================
// GET /api/coaches — 教练列表
// ===========================================================================

describe('GET /api/coaches', () => {
  it('should return coach list with user info and studentCount', async () => {
    const coach = await createTestUser({ isCoach: true, nickname: '测试教练' });
    await createTestCoachProfile({
      userId: coach.id,
      bio: '教练简介',
      specialties: ['singles'],
    });
    const token = signToken(coach.id);

    const res = await request(app).get('/api/coaches').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    const item = res.body.data.items.find((c: { userId: string }) => c.userId === coach.id);
    expect(item).toBeDefined();
    expect(item.nickname).toBe('测试教练');
    expect(item.specialties).toEqual(['singles']);
    expect(typeof item.studentCount).toBe('number');
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(20);
  });

  it('should filter by specialty', async () => {
    const coach1 = await createTestUser({ isCoach: true });
    const coach2 = await createTestUser({ isCoach: true });
    await createTestCoachProfile({ userId: coach1.id, specialties: ['singles', 'footwork'] });
    await createTestCoachProfile({ userId: coach2.id, specialties: ['doubles'] });
    const token = signToken(coach1.id);

    const res = await request(app)
      .get('/api/coaches?specialty=singles')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].userId).toBe(coach1.id);
  });

  it('should reject invalid specialty', async () => {
    const user = await createTestUser({ isCoach: true });
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/coaches?specialty=invalid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_SPECIALTY');
  });

  it('should return empty list when no coaches exist', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app).get('/api/coaches').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });
});

// ===========================================================================
// GET /api/coaches/:id — 教练主页
// ===========================================================================

describe('GET /api/coaches/:id', () => {
  it('should return coach profile with groupClasses and privateLessonSlots', async () => {
    const coach = await createTestUser({ isCoach: true, nickname: '张教练' });
    await createTestCoachProfile({
      userId: coach.id,
      bio: '资深教练',
      specialties: ['singles', 'doubles'],
    });
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(coach.id);
    expect(res.body.data.nickname).toBe('张教练');
    expect(res.body.data.bio).toBe('资深教练');
    expect(res.body.data.specialties).toEqual(['singles', 'doubles']);
    expect(typeof res.body.data.studentCount).toBe('number');
    expect(Array.isArray(res.body.data.groupClasses)).toBe(true);
    expect(Array.isArray(res.body.data.privateLessonSlots)).toBe(true);
  });

  it('should return 404 for non-coach user', async () => {
    const normalUser = await createTestUser({ isCoach: false });
    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/coaches/${normalUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_NOT_A_COACH');
  });

  it('should return 404 for non-existent user', async () => {
    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get('/api/coaches/nonexistent-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_NOT_A_COACH');
  });
});

// ===========================================================================
// POST /api/group-classes — 发布团课
// ===========================================================================

describe('POST /api/group-classes', () => {
  it('should create a group class with status open', async () => {
    const coach = await createTestUser({ isCoach: true });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, name: '朝阳体育中心' });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '初级单打提升班',
        venueId: venue.id,
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 10,
        feeDescription: '200元/人',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.coachId).toBe(coach.id);
    expect(res.body.data.title).toBe('初级单打提升班');
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.currentParticipants).toBe(0);
    expect(res.body.data.venue).toBeDefined();
    expect(res.body.data.venue.id).toBe(venue.id);
    expect(res.body.data.feeDescription).toBe('200元/人');
  });

  it('should reject non-coach user', async () => {
    const user = await createTestUser({ isCoach: false });
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({ cityId: city.id });
    const token = signToken(user.id);

    const res = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '测试',
        venueId: venue.id,
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 10,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_COACH_ROLE_REQUIRED');
  });

  it('should reject empty title', async () => {
    const coach = await createTestUser({ isCoach: true });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '',
        venueId: venue.id,
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_TITLE');
  });

  it('should reject past startTime', async () => {
    const coach = await createTestUser({ isCoach: true });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '测试',
        venueId: venue.id,
        startTime: new Date('2020-01-01T00:00:00.000Z').toISOString(),
        endTime: futureDate(26),
        maxParticipants: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_TIME');
  });

  it('should reject non-existent venue', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '测试',
        venueId: 'nonexistent-venue-uuid',
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 10,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_VENUE_NOT_FOUND');
  });

  it('should reject maxParticipants outside 2-30 range', async () => {
    const coach = await createTestUser({ isCoach: true });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '测试',
        venueId: venue.id,
        startTime: futureDate(24),
        endTime: futureDate(26),
        maxParticipants: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_PARTICIPANTS');
  });
});

// ===========================================================================
// GET /api/group-classes/:id — 团课详情
// ===========================================================================

describe('GET /api/group-classes/:id', () => {
  it('should return group class detail with coach info and enrollments', async () => {
    const coach = await createTestUser({ isCoach: true, nickname: '教练A' });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id, name: '测试球馆' });
    const student = await createTestUser({ nickname: '学员1' });

    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      title: '单打提升班',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
    });

    await addTestEnrollment(groupClass.id, student.id);

    const token = signToken(student.id);
    const res = await request(app)
      .get(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(groupClass.id);
    expect(res.body.data.title).toBe('单打提升班');
    expect(res.body.data.coach).toBeDefined();
    expect(res.body.data.coach.id).toBe(coach.id);
    expect(res.body.data.coach.nickname).toBe('教练A');
    expect(res.body.data.venue).toBeDefined();
    expect(res.body.data.venue.name).toBe('测试球馆');
    expect(res.body.data.enrollments).toHaveLength(1);
    expect(res.body.data.enrollments[0].userId).toBe(student.id);
    expect(res.body.data.enrollments[0].nickname).toBe('学员1');
    expect(res.body.data.currentParticipants).toBe(1);
  });

  it('should return null venue when venueId is null', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      venueId: null,
      title: '无场地团课',
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .get(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.venue).toBeNull();
  });

  it('should return 404 for non-existent group class', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/group-classes/nonexistent-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_GROUP_CLASS_NOT_FOUND');
  });

  it('should return enrollments sorted by enrolledAt ascending', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student1 = await createTestUser({ nickname: '学员1' });
    const student2 = await createTestUser({ nickname: '学员2' });

    const groupClass = await createTestGroupClass({ coachId: coach.id });

    // Add student2 first, then student1 — should still be ordered by enrolledAt
    await addTestEnrollment(groupClass.id, student2.id);
    // Small delay to ensure different enrolledAt times
    await new Promise((resolve) => setTimeout(resolve, 10));
    await addTestEnrollment(groupClass.id, student1.id);

    const token = signToken(coach.id);
    const res = await request(app)
      .get(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.enrollments).toHaveLength(2);
    const dates = res.body.data.enrollments.map((e: { enrolledAt: string }) =>
      new Date(e.enrolledAt).getTime(),
    );
    expect(dates[0]).toBeLessThanOrEqual(dates[1]);
  });
});

// ===========================================================================
// PUT /api/group-classes/:id — 修改团课
// ===========================================================================

describe('PUT /api/group-classes/:id', () => {
  it('should update group class title', async () => {
    const coach = await createTestUser({ isCoach: true });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      title: '原课程名',
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .put(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '新课程名' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('新课程名');
  });

  it('should reject update from non-owner coach', async () => {
    const coach = await createTestUser({ isCoach: true });
    const otherCoach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({ coachId: coach.id });
    const token = signToken(otherCoach.id);

    const res = await request(app)
      .put(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '非法修改' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_NOT_COACH_OWNER');
  });

  it('should reject update of in_progress group class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      status: 'in_progress',
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .put(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '试图修改' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_CLASS_NOT_MODIFIABLE');
  });

  it('should set status to full when maxParticipants equals current enrollments', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student1 = await createTestUser();
    const student2 = await createTestUser();
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      maxParticipants: 10,
    });

    await addTestEnrollment(groupClass.id, student1.id);
    await addTestEnrollment(groupClass.id, student2.id);

    const token = signToken(coach.id);
    const res = await request(app)
      .put(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxParticipants: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('full');
  });

  it('should reject maxParticipants less than current enrollment count', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student1 = await createTestUser();
    const student2 = await createTestUser();
    const student3 = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      maxParticipants: 10,
    });

    await addTestEnrollment(groupClass.id, student1.id);
    await addTestEnrollment(groupClass.id, student2.id);
    await addTestEnrollment(groupClass.id, student3.id);

    const token = signToken(coach.id);
    const res = await request(app)
      .put(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxParticipants: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_PARTICIPANTS_EXCEED');
  });

  it('should send notification to enrolled students after update', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
    });
    await addTestEnrollment(groupClass.id, student.id);

    const token = signToken(coach.id);
    const res = await request(app)
      .put(`/api/group-classes/${groupClass.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '更新后的课程' });

    expect(res.status).toBe(200);

    // Verify notification was created
    const notifications = await prisma.notification.findMany({
      where: { userId: student.id, type: 'GROUP_CLASS_UPDATED' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('团课已更新');
    expect(notifications[0].targetType).toBe('group-class');
    expect(notifications[0].targetId).toBe(groupClass.id);
  });
});

// ===========================================================================
// POST /api/group-classes/:id/cancel — 取消团课
// ===========================================================================

describe('POST /api/group-classes/:id/cancel', () => {
  it('should cancel an open group class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      status: 'open',
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('should cancel a full group class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      status: 'full',
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('should be idempotent for already cancelled class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      status: 'cancelled',
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('should reject cancellation of in_progress class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      status: 'in_progress',
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_CLASS_NOT_CANCELLABLE');
  });

  it('should reject cancellation from non-owner', async () => {
    const coach = await createTestUser({ isCoach: true });
    const otherUser = await createTestUser();
    const groupClass = await createTestGroupClass({ coachId: coach.id });
    const token = signToken(otherUser.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_NOT_COACH_OWNER');
  });

  it('should send notification to enrolled students after cancellation', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      title: '即将取消的课',
    });
    await addTestEnrollment(groupClass.id, student.id);
    const token = signToken(coach.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify notification
    const notifications = await prisma.notification.findMany({
      where: { userId: student.id, type: 'GROUP_CLASS_CANCELLED' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('团课已取消');
    expect(notifications[0].targetType).toBe('group-class');
  });
});

// ===========================================================================
// CoachingService.getGroupClassById — 跨模块 Service 调用
// ===========================================================================

describe('CoachingService.getGroupClassById (cross-module)', () => {
  let service: CoachingService;

  beforeAll(() => {
    const coachingRepo = new CoachingRepository();
    const venueService = new VenueService(new VenueRepository());
    const userService = new UserService(new UserRepository());
    const notificationService = new NotificationService(new NotificationRepository());
    service = new CoachingService(coachingRepo, userService, venueService, notificationService);
  });

  it('should return null for non-existent group class', async () => {
    const result = await service.getGroupClassById('nonexistent-uuid');
    expect(result).toBeNull();
  });

  it('should return group class fields for existing class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      title: '跨模块测试',
    });

    const result = await service.getGroupClassById(groupClass.id);

    expect(result).toBeDefined();
    expect(result!.id).toBe(groupClass.id);
    expect(result!.coachId).toBe(coach.id);
    expect(result!.title).toBe('跨模块测试');
    expect(result!.status).toBe('open');
    expect(result!.startTime).toBeInstanceOf(Date);
    expect(result!.endTime).toBeInstanceOf(Date);
  });
});
