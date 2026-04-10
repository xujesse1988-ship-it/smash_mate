/**
 * L1 集成测试: review 模块 — 评价提交、评价列表、评分查询
 *
 * 测试层级: Controller -> Service -> Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（依赖的 user、coaching、notification 模块均已实现）
 *
 * 覆盖接口:
 * - POST /api/reviews (提交评价)
 * - GET /api/coaches/:id/reviews (教练评价列表)
 * - GET /api/coaches/:id/rating (教练评分查询)
 * - POST /api/coaches/ratings (批量教练评分查询)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { createTestUser } from '@tests/fixtures/user.js';
import { createTestCity, createTestVenue } from '@tests/fixtures/venue.js';
import {
  createTestGroupClass,
  createTestCoachProfile,
  addTestEnrollment,
  createTestPrivateLessonSlot,
  createTestPrivateLesson,
} from '@tests/fixtures/coaching.js';
import { createTestReview, getTestPrisma } from '@tests/fixtures/review.js';
import { resetTestDatabase } from '@tests/fixtures/database.js';

const prisma = getTestPrisma();

function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, { expiresIn: '7d' });
}

function pastDate(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
}

async function cleanup() {
  await resetTestDatabase();
}

beforeAll(async () => {
  await cleanup();
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ===========================================================================
// POST /api/reviews — 提交评价
// ===========================================================================

describe('POST /api/reviews', () => {
  it('should create a review for a completed group class', async () => {
    const coach = await createTestUser({ nickname: '教练A', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员小明' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-review-gc-1' });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      title: '初级羽毛球团课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestEnrollment(gc.id, student.id);

    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc.id,
        rating: 5,
        comment: '教练讲解很细致，推荐！',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      reviewerId: student.id,
      coachId: coach.id,
      courseType: 'group-class',
      courseId: gc.id,
      rating: 5,
      comment: '教练讲解很细致，推荐！',
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('should create a review for a completed private lesson', async () => {
    const coach = await createTestUser({ nickname: '教练B', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员小红' });

    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      isBooked: true,
    });
    const pl = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });

    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coachId: coach.id,
        courseType: 'private-lesson',
        courseId: pl.id,
        rating: 4,
        comment: '不错的体验',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      reviewerId: student.id,
      coachId: coach.id,
      courseType: 'private-lesson',
      courseId: pl.id,
      rating: 4,
    });
  });

  it('should allow review without comment', async () => {
    const coach = await createTestUser({ nickname: '教练C', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员小刚' });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '高级团课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestEnrollment(gc.id, student.id);

    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc.id,
        rating: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.comment).toBeNull();
  });

  it('should send notification to coach after review', async () => {
    const coach = await createTestUser({ nickname: '教练通知', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员通知' });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '通知测试课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestEnrollment(gc.id, student.id);

    const token = signToken(student.id);

    await request(app).post('/api/reviews').set('Authorization', `Bearer ${token}`).send({
      coachId: coach.id,
      courseType: 'group-class',
      courseId: gc.id,
      rating: 5,
      comment: '太棒了',
    });

    // Verify notification was created in the database
    const notification = await prisma.notification.findFirst({
      where: {
        userId: coach.id,
        type: 'REVIEW_RECEIVED',
      },
    });

    expect(notification).not.toBeNull();
    expect(notification!.title).toBe('收到新评价');
    expect(notification!.content).toContain('通知测试课');
    expect(notification!.content).toContain('学员通知');
    expect(notification!.targetType).toBe('coach-profile');
    expect(notification!.targetId).toBe(coach.id);
  });

  it('should reject duplicate review', async () => {
    const coach = await createTestUser({ nickname: '教练D', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员重复' });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '重复测试课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestEnrollment(gc.id, student.id);

    const token = signToken(student.id);
    const body = {
      coachId: coach.id,
      courseType: 'group-class',
      courseId: gc.id,
      rating: 5,
    };

    // First review succeeds
    const res1 = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(res1.status).toBe(201);

    // Second review rejected
    const res2 = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('REVIEW_DUPLICATE');
  });

  it('should reject review for non-coach user', async () => {
    const nonCoach = await createTestUser({ nickname: '普通用户', isCoach: false });
    const student = await createTestUser({ nickname: '学员校验' });

    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coachId: nonCoach.id,
        courseType: 'group-class',
        courseId: nonCoach.id, // fake ID but will fail at coach check first
        rating: 5,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REVIEW_COACH_NOT_FOUND');
  });

  it('should reject self-review', async () => {
    const coach = await createTestUser({ nickname: '自评教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '自评测试课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });

    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc.id,
        rating: 5,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('REVIEW_CANNOT_REVIEW_SELF');
  });

  it('should reject review for non-completed course', async () => {
    const coach = await createTestUser({ nickname: '教练E', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员未完成' });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '未完成课',
      startTime: pastDate(1),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      status: 'open',
    });
    await addTestEnrollment(gc.id, student.id);

    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc.id,
        rating: 5,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REVIEW_COURSE_NOT_COMPLETED');
  });

  it('should reject review from non-participant', async () => {
    const coach = await createTestUser({ nickname: '教练F', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员已报名' });
    const nonParticipant = await createTestUser({ nickname: '路人甲' });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '非参与者测试课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestEnrollment(gc.id, student.id);

    const token = signToken(nonParticipant.id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc.id,
        rating: 5,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('REVIEW_NOT_PARTICIPANT');
  });

  it('should reject invalid rating', async () => {
    const coach = await createTestUser({ nickname: '教练G', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员评分' });

    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: coach.id,
        rating: 6,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REVIEW_INVALID_RATING');
  });

  it('should require authentication', async () => {
    const res = await request(app).post('/api/reviews').send({
      coachId: 'some-id',
      courseType: 'group-class',
      courseId: 'some-id',
      rating: 5,
    });

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/coaches/:id/reviews — 教练评价列表
// ===========================================================================

describe('GET /api/coaches/:id/reviews', () => {
  it('should return paginated review list with reviewer info', async () => {
    const coach = await createTestUser({ nickname: '教练列表', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student1 = await createTestUser({
      nickname: '学员1',
      avatarUrl: 'https://example.com/1.jpg',
    });
    const student2 = await createTestUser({ nickname: '学员2' });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '列表测试课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });

    // Create reviews directly in DB
    await createTestReview({
      reviewerId: student1.id,
      coachId: coach.id,
      courseType: 'group-class',
      courseId: gc.id,
      rating: 5,
      comment: '非常好',
    });
    await createTestReview({
      reviewerId: student2.id,
      coachId: coach.id,
      courseType: 'group-class',
      courseId: gc.id,
      rating: 4,
      comment: '不错',
    });

    const token = signToken(student1.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}/reviews`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(20);
    expect(res.body.data.items).toHaveLength(2);

    // Verify reviewer info is included
    const item = res.body.data.items.find(
      (i: { reviewer: { id: string } }) => i.reviewer.id === student1.id,
    );
    expect(item).toBeDefined();
    expect(item.reviewer.nickname).toBe('学员1');
    expect(item.reviewer.avatarUrl).toBe('https://example.com/1.jpg');
  });

  it('should return empty list for coach with no reviews', async () => {
    const coach = await createTestUser({ nickname: '无评价教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const viewer = await createTestUser({ nickname: '查看者' });

    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}/reviews`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('should support pagination', async () => {
    const coach = await createTestUser({ nickname: '分页教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '分页课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });

    // Create 3 reviews from different students
    for (let i = 0; i < 3; i++) {
      const student = await createTestUser({ nickname: `分页学员${i}` });
      await createTestReview({
        reviewerId: student.id,
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc.id,
        rating: 5 - i,
      });
    }

    const viewer = await createTestUser({ nickname: '分页查看' });
    const token = signToken(viewer.id);

    // Page 1 with pageSize 2
    const res = await request(app)
      .get(`/api/coaches/${coach.id}/reviews?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(2);

    // Page 2 with pageSize 2
    const res2 = await request(app)
      .get(`/api/coaches/${coach.id}/reviews?page=2&pageSize=2`)
      .set('Authorization', `Bearer ${token}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.items).toHaveLength(1);
    expect(res2.body.data.total).toBe(3);
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/coaches/some-id/reviews');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/coaches/:id/rating — 教练评分查询
// ===========================================================================

describe('GET /api/coaches/:id/rating', () => {
  it('should return average rating and total count', async () => {
    const coach = await createTestUser({ nickname: '评分教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      title: '评分课',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });

    // Create reviews with different ratings: 5, 4, 3 -> avg = 4.0
    const ratings = [5, 4, 3];
    for (const rating of ratings) {
      const student = await createTestUser({ nickname: `评分学员${rating}` });
      await createTestReview({
        reviewerId: student.id,
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc.id,
        rating,
      });
    }

    const viewer = await createTestUser({ nickname: '评分查看' });
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}/rating`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      coachId: coach.id,
      averageRating: 4.0,
      totalCount: 3,
    });
  });

  it('should return null rating for coach with no reviews', async () => {
    const coach = await createTestUser({ nickname: '无评价教练2', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const viewer = await createTestUser({ nickname: '查看者2' });

    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/coaches/${coach.id}/rating`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      coachId: coach.id,
      averageRating: null,
      totalCount: 0,
    });
  });

  it('should return null for non-existent coach ID', async () => {
    const viewer = await createTestUser({ nickname: '查看者3' });
    const token = signToken(viewer.id);
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .get(`/api/coaches/${fakeId}/rating`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      coachId: fakeId,
      averageRating: null,
      totalCount: 0,
    });
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/coaches/some-id/rating');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// POST /api/coaches/ratings — 批量教练评分查询
// ===========================================================================

describe('POST /api/coaches/ratings', () => {
  it('should return ratings for multiple coaches', async () => {
    const coach1 = await createTestUser({ nickname: '批量教练1', isCoach: true });
    await createTestCoachProfile({ userId: coach1.id });
    const coach2 = await createTestUser({ nickname: '批量教练2', isCoach: true });
    await createTestCoachProfile({ userId: coach2.id });

    const gc1 = await createTestGroupClass({
      coachId: coach1.id,
      title: '批量课1',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    const gc2 = await createTestGroupClass({
      coachId: coach2.id,
      title: '批量课2',
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });

    const student = await createTestUser({ nickname: '批量学员' });
    await createTestReview({
      reviewerId: student.id,
      coachId: coach1.id,
      courseType: 'group-class',
      courseId: gc1.id,
      rating: 5,
    });
    await createTestReview({
      reviewerId: student.id,
      coachId: coach2.id,
      courseType: 'group-class',
      courseId: gc2.id,
      rating: 3,
    });

    const token = signToken(student.id);

    const res = await request(app)
      .post('/api/coaches/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ coachIds: [coach1.id, coach2.id] });

    expect(res.status).toBe(200);
    expect(res.body.data.ratings).toHaveLength(2);

    // Verify order matches input
    expect(res.body.data.ratings[0].coachId).toBe(coach1.id);
    expect(res.body.data.ratings[0].averageRating).toBe(5.0);
    expect(res.body.data.ratings[0].totalCount).toBe(1);
    expect(res.body.data.ratings[1].coachId).toBe(coach2.id);
    expect(res.body.data.ratings[1].averageRating).toBe(3.0);
    expect(res.body.data.ratings[1].totalCount).toBe(1);
  });

  it('should return null for coaches with no reviews', async () => {
    const coach = await createTestUser({ nickname: '无评价批量', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const viewer = await createTestUser({ nickname: '批量查看' });

    const token = signToken(viewer.id);
    const fakeId = '00000000-0000-0000-0000-000000000001';

    const res = await request(app)
      .post('/api/coaches/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ coachIds: [coach.id, fakeId] });

    expect(res.status).toBe(200);
    expect(res.body.data.ratings).toHaveLength(2);
    expect(res.body.data.ratings[0].coachId).toBe(coach.id);
    expect(res.body.data.ratings[0].averageRating).toBeNull();
    expect(res.body.data.ratings[1].coachId).toBe(fakeId);
    expect(res.body.data.ratings[1].averageRating).toBeNull();
  });

  it('should return empty array for empty coachIds', async () => {
    const viewer = await createTestUser({ nickname: '空批量查看' });
    const token = signToken(viewer.id);

    const res = await request(app)
      .post('/api/coaches/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ coachIds: [] });

    expect(res.status).toBe(200);
    expect(res.body.data.ratings).toEqual([]);
  });

  it('should reject invalid coachIds', async () => {
    const viewer = await createTestUser({ nickname: '错误查看' });
    const token = signToken(viewer.id);

    const res = await request(app)
      .post('/api/coaches/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ coachIds: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REVIEW_INVALID_COACH_IDS');
  });

  it('should reject more than 100 coachIds', async () => {
    const viewer = await createTestUser({ nickname: '超量查看' });
    const token = signToken(viewer.id);

    const manyIds = Array.from(
      { length: 101 },
      (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    );

    const res = await request(app)
      .post('/api/coaches/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ coachIds: manyIds });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REVIEW_INVALID_COACH_IDS');
  });

  it('should require authentication', async () => {
    const res = await request(app).post('/api/coaches/ratings').send({ coachIds: [] });

    expect(res.status).toBe(401);
  });
});
