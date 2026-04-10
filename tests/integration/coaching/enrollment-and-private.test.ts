/**
 * L1 集成测试: coaching 模块 — 团课报名/取消、私教空闲时间/预约/取消、课程列表、定时状态流转
 *
 * 测试层级: Controller → Service → Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（coaching 依赖的 user、venue、notification 模块均已实现并可用）
 *
 * 覆盖接口:
 * - POST /api/group-classes/:id/enroll (报名团课)
 * - POST /api/group-classes/:id/cancel-enrollment (取消报名)
 * - POST /api/private-lessons/availability (设置私教空闲时间)
 * - GET /api/coaches/:id/availability (获取教练空闲时间)
 * - POST /api/private-lessons/book (预约私教课)
 * - POST /api/private-lessons/:id/cancel (取消私教预约)
 * - GET /api/users/:id/enrollments (用户课程报名列表)
 * - GET /api/coaches/:id/private-lessons (教练私教预约列表)
 * - CoachingService.getPrivateLessonById (跨模块 Service 调用)
 * - CoachingService.getParticipantIds (跨模块 Service 调用)
 * - 定时任务: 课程状态自动流转 (processStatusTransitions)
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
  createTestGroupClass,
  addTestEnrollment,
  createTestPrivateLessonSlot,
  createTestPrivateLesson,
  getTestPrisma,
} from '@tests/fixtures/coaching.js';
import { resetTestDatabase } from '@tests/fixtures/database.js';

const prisma = getTestPrisma();

function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

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
// POST /api/group-classes/:id/enroll — 报名团课
// ===========================================================================

describe('POST /api/group-classes/:id/enroll', () => {
  it('should enroll a student in an open group class', async () => {
    const coach = await createTestUser({ isCoach: true, nickname: '教练A' });
    const student = await createTestUser({ nickname: '学员B' });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      maxParticipants: 10,
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/enroll`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.groupClassId).toBe(groupClass.id);
    expect(res.body.data.userId).toBe(student.id);
    expect(res.body.data.currentParticipants).toBe(1);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.enrolledAt).toBeDefined();
  });

  it('should auto-set status to full when enrollment fills the class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student1 = await createTestUser();
    const student2 = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      maxParticipants: 2,
    });

    // Fill one spot
    await addTestEnrollment(groupClass.id, student1.id);

    // Enroll second student, should fill
    const token = signToken(student2.id);
    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/enroll`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.currentParticipants).toBe(2);
    expect(res.body.data.status).toBe('full');
  });

  it('should notify the coach after enrollment', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser({ nickname: '学员小明' });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      title: '测试报名课程',
    });
    const token = signToken(student.id);

    await request(app)
      .post(`/api/group-classes/${groupClass.id}/enroll`)
      .set('Authorization', `Bearer ${token}`);

    // Verify notification was created
    const notifications = await prisma.notification.findMany({
      where: { userId: coach.id, type: 'GROUP_CLASS_ENROLLED' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('新学员报名');
    expect(notifications[0].targetType).toBe('group-class');
    expect(notifications[0].targetId).toBe(groupClass.id);
  });

  it('should return 404 for non-existent group class', async () => {
    const student = await createTestUser();
    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/group-classes/nonexistent-uuid/enroll')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_GROUP_CLASS_NOT_FOUND');
  });

  it('should return 403 when coach enrolls in own class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/enroll`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_CANNOT_ENROLL_OWN_CLASS');
  });

  it('should return 409 when already enrolled', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      maxParticipants: 10,
    });
    await addTestEnrollment(groupClass.id, student.id);
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/enroll`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_ALREADY_ENROLLED');
  });

  it('should return 409 when class is full', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      maxParticipants: 2,
      status: 'full',
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/enroll`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_CLASS_FULL');
  });

  it('should return 409 when class status is in_progress', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      status: 'in_progress',
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/enroll`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_CLASS_NOT_ENROLLABLE');
  });
});

// ===========================================================================
// POST /api/group-classes/:id/cancel-enrollment — 取消报名
// ===========================================================================

describe('POST /api/group-classes/:id/cancel-enrollment', () => {
  it('should cancel enrollment from an open group class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      maxParticipants: 10,
    });
    await addTestEnrollment(groupClass.id, student.id);
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel-enrollment`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.groupClassId).toBe(groupClass.id);
    expect(res.body.data.userId).toBe(student.id);
    expect(res.body.data.currentParticipants).toBe(0);
    expect(res.body.data.status).toBe('open');
  });

  it('should restore status to open when cancel-enrollment from a full class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student1 = await createTestUser();
    const student2 = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      maxParticipants: 2,
      status: 'full',
    });
    await addTestEnrollment(groupClass.id, student1.id);
    await addTestEnrollment(groupClass.id, student2.id);

    const token = signToken(student1.id);
    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel-enrollment`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.currentParticipants).toBe(1);
  });

  it('should notify the coach after cancellation', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser({ nickname: '取消学员' });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      title: '被取消报名的课',
    });
    await addTestEnrollment(groupClass.id, student.id);
    const token = signToken(student.id);

    await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel-enrollment`)
      .set('Authorization', `Bearer ${token}`);

    const notifications = await prisma.notification.findMany({
      where: { userId: coach.id, type: 'GROUP_CLASS_ENROLLMENT_CANCELLED' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('学员取消报名');
  });

  it('should return 409 when student is not enrolled', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({ coachId: coach.id });
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel-enrollment`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_NOT_ENROLLED');
  });

  it('should return 409 when class is in_progress', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      status: 'in_progress',
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/group-classes/${groupClass.id}/cancel-enrollment`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT');
  });
});

// ===========================================================================
// POST /api/private-lessons/availability — 设置私教空闲时间
// ===========================================================================

describe('POST /api/private-lessons/availability', () => {
  it('should create availability slots for a coach', async () => {
    const coach = await createTestUser({ isCoach: true });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slots: [
          {
            startTime: futureDate(24),
            endTime: futureDate(26),
            venueIds: [venue.id],
            feeDescription: '300元/小时',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.slots).toBeDefined();
    expect(res.body.data.slots).toHaveLength(1);
    expect(res.body.data.slots[0].coachId).toBe(coach.id);
    expect(res.body.data.slots[0].isBooked).toBe(false);
  });

  it('should create multiple slots in one request', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slots: [
          {
            startTime: futureDate(24),
            endTime: futureDate(26),
          },
          {
            startTime: futureDate(48),
            endTime: futureDate(50),
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.slots).toHaveLength(2);
  });

  it('should reject non-coach user', async () => {
    const user = await createTestUser({ isCoach: false });
    const token = signToken(user.id);

    const res = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slots: [{ startTime: futureDate(24), endTime: futureDate(26) }],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_COACH_ROLE_REQUIRED');
  });

  it('should reject empty slots array', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ slots: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_SLOTS');
  });

  it('should reject slot with duration less than 1 hour', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const start = futureDate(24);
    const end = new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slots: [{ startTime: start, endTime: end }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_SLOT_TOO_SHORT');
  });

  it('should reject overlapping slots within the same batch', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slots: [
          { startTime: futureDate(24), endTime: futureDate(26) },
          { startTime: futureDate(25), endTime: futureDate(27) }, // overlaps
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_SLOT_OVERLAP');
  });

  it('should reject slot overlapping with existing slot', async () => {
    const coach = await createTestUser({ isCoach: true });
    // Create an existing slot
    await createTestPrivateLessonSlot({
      coachId: coach.id,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
    });
    const token = signToken(coach.id);

    // Try to create overlapping slot
    const res = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slots: [
          {
            startTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString(),
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_SLOT_OVERLAP');
  });

  it('should reject non-existent venue in venueIds', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slots: [
          {
            startTime: futureDate(24),
            endTime: futureDate(26),
            venueIds: ['nonexistent-venue-uuid'],
          },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_VENUE_NOT_FOUND');
  });
});

// ===========================================================================
// GET /api/coaches/:id/availability — 获取教练空闲时间
// ===========================================================================

describe('GET /api/coaches/:id/availability', () => {
  it('should return availability slots for a valid coach', async () => {
    const coach = await createTestUser({ isCoach: true });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id, name: '测试球馆' });
    await createTestPrivateLessonSlot({
      coachId: coach.id,
      venueIds: [venue.id],
      feeDescription: '300元/小时',
    });

    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}/availability`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.slots).toBeDefined();
    expect(res.body.data.slots.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.slots[0].venues).toBeDefined();
    expect(res.body.data.slots[0].venues[0].name).toBe('测试球馆');
  });

  it('should return empty slots when coach has no availability', async () => {
    const coach = await createTestUser({ isCoach: true });
    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}/availability`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.slots).toHaveLength(0);
  });

  it('should return 404 for non-coach user', async () => {
    const normalUser = await createTestUser({ isCoach: false });
    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/coaches/${normalUser.id}/availability`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_NOT_A_COACH');
  });

  it('should include both booked and unbooked slots', async () => {
    const coach = await createTestUser({ isCoach: true });
    await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: false,
    });
    await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
      startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 74 * 60 * 60 * 1000),
    });

    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}/availability`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.slots.length).toBe(2);
  });
});

// ===========================================================================
// POST /api/private-lessons/book — 预约私教课
// ===========================================================================

describe('POST /api/private-lessons/book', () => {
  it('should book a private lesson with valid input', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser({ nickname: '预约学员' });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id, name: '预约球馆' });
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      venueIds: [venue.id],
      feeDescription: '300元/小时',
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slotId: slot.id,
        venueId: venue.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.coachId).toBe(coach.id);
    expect(res.body.data.studentId).toBe(student.id);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.slotId).toBe(slot.id);

    // Verify slot is now booked
    const updatedSlot = await prisma.privateLessonSlot.findUnique({
      where: { id: slot.id },
    });
    expect(updatedSlot?.isBooked).toBe(true);
  });

  it('should allow booking without venueId when slot has no venue restriction', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      venueIds: [],
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ slotId: slot.id });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('scheduled');
  });

  it('should notify coach after booking', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser({ nickname: '小明' });
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      venueIds: [],
    });
    const token = signToken(student.id);

    await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ slotId: slot.id });

    const notifications = await prisma.notification.findMany({
      where: { userId: coach.id, type: 'PRIVATE_LESSON_BOOKED' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('新私教预约');
    expect(notifications[0].targetType).toBe('private-lesson');
  });

  it('should return 400 when slotId is empty', async () => {
    const student = await createTestUser();
    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ slotId: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_SLOT');
  });

  it('should return 404 when slot does not exist', async () => {
    const student = await createTestUser();
    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ slotId: 'nonexistent-slot-uuid' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_SLOT_NOT_FOUND');
  });

  it('should return 409 when slot is already booked', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ slotId: slot.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_SLOT_ALREADY_BOOKED');
  });

  it('should return 403 when coach books own slot', async () => {
    const coach = await createTestUser({ isCoach: true });
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      venueIds: [],
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ slotId: slot.id });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_CANNOT_BOOK_OWN_LESSON');
  });

  it('should return 400 when venue required but not provided', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id });
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      venueIds: [venue.id],
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ slotId: slot.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_VENUE_REQUIRED');
  });

  it('should return 400 when venueId not in slot venueIds', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const city = await createTestCity();
    const venue1 = await createTestVenue({ cityId: city.id });
    const venue2 = await createTestVenue({ cityId: city.id });
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      venueIds: [venue1.id],
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ slotId: slot.id, venueId: venue2.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COACHING_INVALID_VENUE_CHOICE');
  });
});

// ===========================================================================
// POST /api/private-lessons/:id/cancel — 取消私教预约
// ===========================================================================

describe('POST /api/private-lessons/:id/cancel', () => {
  it('should cancel a scheduled private lesson by student', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/private-lessons/${lesson.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(lesson.id);
    expect(res.body.data.status).toBe('cancelled');

    // Verify slot was released
    const updatedSlot = await prisma.privateLessonSlot.findUnique({
      where: { id: slot.id },
    });
    expect(updatedSlot?.isBooked).toBe(false);
  });

  it('should cancel a scheduled private lesson by coach', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    const token = signToken(coach.id);

    const res = await request(app)
      .post(`/api/private-lessons/${lesson.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('should be idempotent for already cancelled lesson', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: false,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      status: 'cancelled',
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/private-lessons/${lesson.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('should notify coach when student cancels', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser({ nickname: '学员小王' });
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
    });
    const token = signToken(student.id);

    await request(app)
      .post(`/api/private-lessons/${lesson.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const notifications = await prisma.notification.findMany({
      where: { userId: coach.id, type: 'PRIVATE_LESSON_CANCELLED_BY_STUDENT' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('学员取消私教');
    expect(notifications[0].targetType).toBe('private-lesson');
  });

  it('should notify student when coach cancels', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
    });
    const token = signToken(coach.id);

    await request(app)
      .post(`/api/private-lessons/${lesson.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const notifications = await prisma.notification.findMany({
      where: { userId: student.id, type: 'PRIVATE_LESSON_CANCELLED_BY_COACH' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('教练取消私教');
    expect(notifications[0].targetType).toBe('coach-profile');
    expect(notifications[0].targetId).toBe(coach.id);
  });

  it('should return 404 for non-existent lesson', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .post('/api/private-lessons/nonexistent-uuid/cancel')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_PRIVATE_LESSON_NOT_FOUND');
  });

  it('should return 403 when user is not a participant', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const other = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
    });
    const token = signToken(other.id);

    const res = await request(app)
      .post(`/api/private-lessons/${lesson.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_NOT_LESSON_PARTICIPANT');
  });

  it('should return 409 when lesson is in_progress', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      status: 'in_progress',
    });
    const token = signToken(student.id);

    const res = await request(app)
      .post(`/api/private-lessons/${lesson.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COACHING_LESSON_NOT_CANCELLABLE');
  });
});

// ===========================================================================
// GET /api/users/:id/enrollments — 用户课程报名列表
// ===========================================================================

describe('GET /api/users/:id/enrollments', () => {
  it('should return merged list of group class enrollments and private lessons', async () => {
    const coach = await createTestUser({ isCoach: true, nickname: '教练张' });
    const student = await createTestUser();
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id, name: '球馆1' });

    // Create group class enrollment
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      title: '团课1',
    });
    await addTestEnrollment(groupClass.id, student.id);

    // Create private lesson
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      venueId: venue.id,
    });

    const token = signToken(student.id);
    const res = await request(app)
      .get(`/api/users/${student.id}/enrollments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(2);

    // Verify both types exist
    const types = res.body.data.items.map((i: { type: string }) => i.type);
    expect(types).toContain('group-class');
    expect(types).toContain('private-lesson');
  });

  it('should filter by type=group-class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({ coachId: coach.id });
    await addTestEnrollment(groupClass.id, student.id);

    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
    });

    const token = signToken(student.id);
    const res = await request(app)
      .get(`/api/users/${student.id}/enrollments?type=group-class`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.every((i: { type: string }) => i.type === 'group-class')).toBe(true);
  });

  it('should filter by status', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const openClass = await createTestGroupClass({ coachId: coach.id, status: 'open' });
    const cancelledClass = await createTestGroupClass({ coachId: coach.id, status: 'cancelled' });
    await addTestEnrollment(openClass.id, student.id);
    await addTestEnrollment(cancelledClass.id, student.id);

    const token = signToken(student.id);
    const res = await request(app)
      .get(`/api/users/${student.id}/enrollments?status=open`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const item of res.body.data.items) {
      if (item.type === 'group-class') {
        expect(item.groupClass.status).toBe('open');
      }
    }
  });

  it('should return empty list when user has no enrollments', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get(`/api/users/${user.id}/enrollments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it('should include coach nickname', async () => {
    const coach = await createTestUser({ isCoach: true, nickname: '教练昵称' });
    const student = await createTestUser();
    const groupClass = await createTestGroupClass({ coachId: coach.id });
    await addTestEnrollment(groupClass.id, student.id);

    const token = signToken(student.id);
    const res = await request(app)
      .get(`/api/users/${student.id}/enrollments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].groupClass.coachNickname).toBe('教练昵称');
  });
});

// ===========================================================================
// GET /api/coaches/:id/private-lessons — 教练私教预约列表
// ===========================================================================

describe('GET /api/coaches/:id/private-lessons', () => {
  it('should return private lessons list with student info', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser({ nickname: '学员A' });
    const city = await createTestCity();
    const venue = await createTestVenue({ cityId: city.id, name: '球馆X' });
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      venueId: venue.id,
    });

    const token = signToken(coach.id);
    const res = await request(app)
      .get(`/api/coaches/${coach.id}/private-lessons`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].student.nickname).toBe('学员A');
    expect(res.body.data.items[0].venue.name).toBe('球馆X');
    expect(res.body.data.items[0].status).toBe('scheduled');
    expect(res.body.data.items[0].slot).toBeDefined();
  });

  it('should filter by status', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student1 = await createTestUser();
    const student2 = await createTestUser();

    const slot1 = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    await createTestPrivateLesson({
      slotId: slot1.id,
      coachId: coach.id,
      studentId: student1.id,
      status: 'scheduled',
    });

    const slot2 = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: false,
      startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 74 * 60 * 60 * 1000),
    });
    await createTestPrivateLesson({
      slotId: slot2.id,
      coachId: coach.id,
      studentId: student2.id,
      status: 'cancelled',
    });

    const token = signToken(coach.id);
    const res = await request(app)
      .get(`/api/coaches/${coach.id}/private-lessons?status=scheduled`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe('scheduled');
  });

  it('should return empty list when no private lessons', async () => {
    const coach = await createTestUser({ isCoach: true });
    const token = signToken(coach.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}/private-lessons`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it('should return 404 for non-coach user', async () => {
    const normalUser = await createTestUser({ isCoach: false });
    const token = signToken(normalUser.id);

    const res = await request(app)
      .get(`/api/coaches/${normalUser.id}/private-lessons`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COACHING_NOT_A_COACH');
  });
});

// ===========================================================================
// CoachingService.getPrivateLessonById — 跨模块 Service 调用
// ===========================================================================

describe('CoachingService.getPrivateLessonById (cross-module)', () => {
  let service: CoachingService;

  beforeAll(() => {
    const coachingRepo = new CoachingRepository();
    const venueService = new VenueService(new VenueRepository());
    const userService = new UserService(new UserRepository());
    const notificationService = new NotificationService(new NotificationRepository());
    service = new CoachingService(coachingRepo, userService, venueService, notificationService);
  });

  it('should return null for non-existent private lesson', async () => {
    const result = await service.getPrivateLessonById('nonexistent-uuid');
    expect(result).toBeNull();
  });

  it('should return private lesson fields for existing lesson', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
    });

    const result = await service.getPrivateLessonById(lesson.id);

    expect(result).toBeDefined();
    expect(result!.id).toBe(lesson.id);
    expect(result!.coachId).toBe(coach.id);
    expect(result!.studentId).toBe(student.id);
    expect(result!.status).toBe('scheduled');
    expect(result!.startTime).toBeInstanceOf(Date);
    expect(result!.endTime).toBeInstanceOf(Date);
  });
});

// ===========================================================================
// CoachingService.getParticipantIds — 跨模块 Service 调用
// ===========================================================================

describe('CoachingService.getParticipantIds (cross-module)', () => {
  let service: CoachingService;

  beforeAll(() => {
    const coachingRepo = new CoachingRepository();
    const venueService = new VenueService(new VenueRepository());
    const userService = new UserService(new UserRepository());
    const notificationService = new NotificationService(new NotificationRepository());
    service = new CoachingService(coachingRepo, userService, venueService, notificationService);
  });

  it('should return coach + enrolled students for group-class', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student1 = await createTestUser();
    const student2 = await createTestUser();
    const groupClass = await createTestGroupClass({ coachId: coach.id });
    await addTestEnrollment(groupClass.id, student1.id);
    await addTestEnrollment(groupClass.id, student2.id);

    const result = await service.getParticipantIds(groupClass.id, 'group-class');

    expect(result).toBeDefined();
    expect(result).toContain(coach.id);
    expect(result).toContain(student1.id);
    expect(result).toContain(student2.id);
    expect(result.length).toBe(3);
  });

  it('should return coach + student for private-lesson', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
    });

    const result = await service.getParticipantIds(lesson.id, 'private-lesson');

    expect(result).toContain(coach.id);
    expect(result).toContain(student.id);
    expect(result.length).toBe(2);
  });

  it('should return empty array for non-existent group class', async () => {
    const result = await service.getParticipantIds('nonexistent-uuid', 'group-class');
    expect(result).toEqual([]);
  });

  it('should return empty array for non-existent private lesson', async () => {
    const result = await service.getParticipantIds('nonexistent-uuid', 'private-lesson');
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// 定时任务: 课程状态自动流转 — processStatusTransitions
// ===========================================================================

describe('processStatusTransitions (status auto-transition)', () => {
  let service: CoachingService;

  beforeAll(() => {
    const coachingRepo = new CoachingRepository();
    const venueService = new VenueService(new VenueRepository());
    const userService = new UserService(new UserRepository());
    const notificationService = new NotificationService(new NotificationRepository());
    service = new CoachingService(coachingRepo, userService, venueService, notificationService);
  });

  it('should transition open group class to in_progress when startTime has passed', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      status: 'open',
    });

    await service.processStatusTransitions();

    const updated = await prisma.groupClass.findUnique({ where: { id: groupClass.id } });
    expect(updated?.status).toBe('in_progress');
  });

  it('should transition in_progress group class to completed when endTime has passed', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      endTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      status: 'in_progress',
    });

    await service.processStatusTransitions();

    const updated = await prisma.groupClass.findUnique({ where: { id: groupClass.id } });
    expect(updated?.status).toBe('completed');
  });

  it('should transition scheduled private lesson to in_progress when startTime has passed', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'scheduled',
    });

    await service.processStatusTransitions();

    const updated = await prisma.privateLesson.findUnique({ where: { id: lesson.id } });
    expect(updated?.status).toBe('in_progress');
  });

  it('should transition in_progress private lesson to completed when endTime has passed', async () => {
    const coach = await createTestUser({ isCoach: true });
    const student = await createTestUser();
    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      isBooked: true,
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 60 * 60 * 1000),
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'in_progress',
    });

    await service.processStatusTransitions();

    const updated = await prisma.privateLesson.findUnique({ where: { id: lesson.id } });
    expect(updated?.status).toBe('completed');
  });

  it('should not transition cancelled courses', async () => {
    const coach = await createTestUser({ isCoach: true });
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      status: 'cancelled',
    });

    await service.processStatusTransitions();

    const updated = await prisma.groupClass.findUnique({ where: { id: groupClass.id } });
    expect(updated?.status).toBe('cancelled');
  });
});
