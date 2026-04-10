/**
 * L2 跨模块集成测试: 教练团课全流程
 * 关键路径: 发布团课 → 学员报名 → 状态流转到已结束 → 提交评价 → 录入战绩
 *
 * 涉及模块: user, venue, coaching, review, match-record, notification
 * 测试层级: 真实模块间调用（不 Mock 其他模块），真实 PostgreSQL 测试库
 *
 * 对应 Issue: #56
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { createTestUser } from '@tests/fixtures/user.js';
import { createTestCity, createTestVenue } from '@tests/fixtures/venue.js';
import { createTestCoachProfile, getTestPrisma } from '@tests/fixtures/coaching.js';
import { resetTestDatabase } from '@tests/fixtures/database.js';

const prisma = getTestPrisma();

function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, { expiresIn: '7d' });
}

/** Create a date in the past (hours ago from now) */
function pastDate(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
}

/** Create a date in the future (hours from now) */
function futureDate(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
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

// =============================================================================
// 正常流程: 教练团课全生命周期
// =============================================================================

describe('关键路径: 教练团课全流程（发布→报名→结束→评价+战绩）', () => {
  it('完整正常流程: 发布团课 → 学员报名 → 团课状态变为已结束 → 学员提交评价 → 教练平均评分更新 → 学员录入战绩', async () => {
    // -----------------------------------------------------------------------
    // Step 1: 准备测试数据 — 创建教练、学员和球馆
    // -----------------------------------------------------------------------
    const coach = await createTestUser({ nickname: '教练王', isCoach: true });
    await createTestCoachProfile({ userId: coach.id, specialties: ['singles', 'footwork'] });
    const student1 = await createTestUser({ nickname: '学员小明' });
    const student2 = await createTestUser({ nickname: '学员小红' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '朝阳体育中心',
      mapPoiId: 'poi-gc-l2-1',
    });

    const coachToken = signToken(coach.id);
    const student1Token = signToken(student1.id);
    const student2Token = signToken(student2.id);

    // -----------------------------------------------------------------------
    // Step 2: 教练发布团课（coaching 模块 — POST /api/group-classes）
    // -----------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: 'L2测试单打提升班',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
        feeDescription: '200元/人',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('open');
    expect(createRes.body.data.title).toBe('L2测试单打提升班');

    const groupClassId = createRes.body.data.id;

    // -----------------------------------------------------------------------
    // Step 3: 学员报名团课（coaching 模块 — POST /api/group-classes/:id/enroll）
    //         验证跨模块通知：报名时通知教练（coaching → notification）
    // -----------------------------------------------------------------------
    const enroll1Res = await request(app)
      .post(`/api/group-classes/${groupClassId}/enroll`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(enroll1Res.status).toBe(200);
    expect(enroll1Res.body.data.currentParticipants).toBe(1);
    expect(enroll1Res.body.data.status).toBe('open');

    // 验证通知: 教练收到"新学员报名"通知（coaching → notification 跨模块调用）
    const enrollNotification1 = await prisma.notification.findFirst({
      where: { userId: coach.id, type: 'GROUP_CLASS_ENROLLED' },
    });
    expect(enrollNotification1).not.toBeNull();
    expect(enrollNotification1!.content).toContain('学员小明');
    expect(enrollNotification1!.content).toContain('L2测试单打提升班');
    expect(enrollNotification1!.targetType).toBe('group-class');
    expect(enrollNotification1!.targetId).toBe(groupClassId);

    // 第二位学员报名
    const enroll2Res = await request(app)
      .post(`/api/group-classes/${groupClassId}/enroll`)
      .set('Authorization', `Bearer ${student2Token}`);

    expect(enroll2Res.status).toBe(200);
    expect(enroll2Res.body.data.currentParticipants).toBe(2);

    // -----------------------------------------------------------------------
    // Step 4: 团课状态变为已结束
    //         模拟时间流逝：直接将团课时间设为过去，再调用状态流转定时任务
    // -----------------------------------------------------------------------
    await prisma.groupClass.update({
      where: { id: groupClassId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'in_progress', // open → in_progress (模拟开始时间已过)
      },
    });

    // 调用 coaching 的状态流转任务（模拟定时任务触发）
    const { CoachingService } = await import('@server/modules/coaching/service.js');
    const { CoachingRepository } = await import('@server/modules/coaching/repository.js');
    const { VenueService } = await import('@server/modules/venue/service.js');
    const { VenueRepository } = await import('@server/modules/venue/repository.js');
    const { UserService } = await import('@server/modules/user/service.js');
    const { UserRepository } = await import('@server/modules/user/repository.js');
    const { NotificationService } = await import('@server/modules/notification/service.js');
    const { NotificationRepository } = await import('@server/modules/notification/repository.js');

    const coachingService = new CoachingService(
      new CoachingRepository(),
      new UserService(new UserRepository()),
      new VenueService(new VenueRepository()),
      new NotificationService(new NotificationRepository()),
    );

    await coachingService.processStatusTransitions();

    // 验证团课状态已变为 completed
    const gcAfterTransition = await prisma.groupClass.findUnique({
      where: { id: groupClassId },
    });
    expect(gcAfterTransition!.status).toBe('completed');

    // -----------------------------------------------------------------------
    // Step 5: 学员提交评价（review 模块 — POST /api/reviews）
    //         跨模块调用: review → coaching（校验参与关系 + 课程状态）
    //                     review → notification（通知教练）
    //                     review → user（获取学员昵称用于通知文案）
    // -----------------------------------------------------------------------
    const review1Res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: groupClassId,
        rating: 5,
        comment: '教练讲解非常细致，步法训练很有效！',
      });

    expect(review1Res.status).toBe(201);
    expect(review1Res.body.data).toMatchObject({
      reviewerId: student1.id,
      coachId: coach.id,
      courseType: 'group-class',
      courseId: groupClassId,
      rating: 5,
      comment: '教练讲解非常细致，步法训练很有效！',
    });

    // 验证通知: 教练收到"收到新评价"通知（review → notification 跨模块调用）
    const reviewNotification1 = await prisma.notification.findFirst({
      where: { userId: coach.id, type: 'REVIEW_RECEIVED' },
    });
    expect(reviewNotification1).not.toBeNull();
    expect(reviewNotification1!.title).toBe('收到新评价');
    expect(reviewNotification1!.content).toContain('学员小明');
    expect(reviewNotification1!.content).toContain('L2测试单打提升班');
    expect(reviewNotification1!.targetType).toBe('coach-profile');
    expect(reviewNotification1!.targetId).toBe(coach.id);

    // 第二位学员也提交评价
    const review2Res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: groupClassId,
        rating: 4,
        comment: '不错的课程',
      });

    expect(review2Res.status).toBe(201);
    expect(review2Res.body.data.rating).toBe(4);

    // -----------------------------------------------------------------------
    // Step 6: 验证教练平均评分正确更新（review 模块 — GET /api/coaches/:id/rating）
    //         两位学员评分 5 和 4，平均 4.5
    // -----------------------------------------------------------------------
    const ratingRes = await request(app)
      .get(`/api/coaches/${coach.id}/rating`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(ratingRes.status).toBe(200);
    expect(ratingRes.body.data).toEqual({
      coachId: coach.id,
      averageRating: 4.5,
      totalCount: 2,
    });

    // -----------------------------------------------------------------------
    // Step 7: 学员录入战绩（match-record 模块 — POST /api/match-records）
    //         跨模块调用: match-record → coaching（校验参与关系 + 团课状态）
    // -----------------------------------------------------------------------
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        sourceType: 'group-class',
        sourceId: groupClassId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: student1.id }],
          sideB: [{ userId: student2.id }],
        },
        games: [
          { scoreA: 21, scoreB: 18 },
          { scoreA: 15, scoreB: 21 },
          { scoreA: 21, scoreB: 19 },
        ],
      });

    expect(recordRes.status).toBe(201);
    expect(recordRes.body.data.sourceType).toBe('group-class');
    expect(recordRes.body.data.sourceId).toBe(groupClassId);
    expect(recordRes.body.data.matchType).toBe('singles');
    expect(recordRes.body.data.recordedBy).toBe(student1.id);
    expect(recordRes.body.data.result).toBe('A_WIN'); // student1 wins 2-1
    expect(recordRes.body.data.games).toHaveLength(3);

    // -----------------------------------------------------------------------
    // Step 8: 查看团课战绩列表（match-record 模块 — GET /api/group-classes/:id/match-records）
    // -----------------------------------------------------------------------
    const matchListRes = await request(app)
      .get(`/api/group-classes/${groupClassId}/match-records`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(matchListRes.status).toBe(200);
    expect(matchListRes.body.data.items).toHaveLength(1);
    expect(matchListRes.body.data.items[0].sourceType).toBe('group-class');
    expect(matchListRes.body.data.items[0].result).toBe('A_WIN');

    // -----------------------------------------------------------------------
    // Step 9: 验证教练评价列表包含两条评价（review 模块 — GET /api/coaches/:id/reviews）
    // -----------------------------------------------------------------------
    const reviewListRes = await request(app)
      .get(`/api/coaches/${coach.id}/reviews`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(reviewListRes.status).toBe(200);
    expect(reviewListRes.body.data.total).toBe(2);
    expect(reviewListRes.body.data.items).toHaveLength(2);

    // 评价按时间倒序（最新在前），student2 的评价在前
    const latestReview = reviewListRes.body.data.items[0];
    expect(latestReview.rating).toBe(4);
    expect(latestReview.reviewer.nickname).toBe('学员小红');

    // -----------------------------------------------------------------------
    // Step 10: 验证个人战绩统计反映录入的战绩（match-record 模块）
    // -----------------------------------------------------------------------
    const student1Stats = await request(app)
      .get(`/api/users/${student1.id}/match-stats`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(student1Stats.status).toBe(200);
    expect(student1Stats.body.data.totalMatches).toBe(1);
    expect(student1Stats.body.data.wins).toBe(1);
    expect(student1Stats.body.data.losses).toBe(0);

    const student2Stats = await request(app)
      .get(`/api/users/${student2.id}/match-stats`)
      .set('Authorization', `Bearer ${student2Token}`);

    expect(student2Stats.status).toBe(200);
    expect(student2Stats.body.data.totalMatches).toBe(1);
    expect(student2Stats.body.data.wins).toBe(0);
    expect(student2Stats.body.data.losses).toBe(1);
  });

  it('教练也是参与者: 教练可以在自己的团课中录入战绩', async () => {
    // 准备数据
    const coach = await createTestUser({ nickname: '教练参与', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员参与' });
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '虹口体育馆',
      mapPoiId: 'poi-gc-l2-2',
    });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 发布团课
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: '教练亲自参与课',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
      });

    expect(createRes.status).toBe(201);
    const gcId = createRes.body.data.id;

    // 学员报名
    await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    // 团课变为已结束
    await prisma.groupClass.update({
      where: { id: gcId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 教练录入战绩（教练是 coaching.getParticipantIds 中的参与者）
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        sourceType: 'group-class',
        sourceId: gcId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: coach.id }],
          sideB: [{ userId: student.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(201);
    expect(recordRes.body.data.recordedBy).toBe(coach.id);
    expect(recordRes.body.data.result).toBe('A_WIN');
  });
});

// =============================================================================
// 异常流程: 重复评价拦截
// =============================================================================

describe('异常路径: 重复评价拦截', () => {
  it('同一学员对同一团课不能评价两次', async () => {
    const coach = await createTestUser({ nickname: '教练重复评价', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员重复评价' });
    const city = await createTestCity({ name: '深圳' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '南山体育馆',
      mapPoiId: 'poi-gc-l2-3',
    });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 发布团课并报名
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: '重复评价测试课',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
      });

    const gcId = createRes.body.data.id;

    await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    // 团课变为已结束
    await prisma.groupClass.update({
      where: { id: gcId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 第一次评价成功
    const review1 = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gcId,
        rating: 5,
        comment: '第一次评价',
      });

    expect(review1.status).toBe(201);

    // 第二次评价被拦截
    const review2 = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gcId,
        rating: 3,
        comment: '想修改评价',
      });

    expect(review2.status).toBe(409);
    expect(review2.body.error.code).toBe('REVIEW_DUPLICATE');

    // 验证评分仍然是第一次的值（只有一条评价）
    const ratingRes = await request(app)
      .get(`/api/coaches/${coach.id}/rating`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(ratingRes.status).toBe(200);
    expect(ratingRes.body.data.averageRating).toBe(5.0);
    expect(ratingRes.body.data.totalCount).toBe(1);
  });
});

// =============================================================================
// 异常流程: 课程未结束时评价拦截
// =============================================================================

describe('异常路径: 课程未结束时评价拦截', () => {
  it('团课状态为 open 时不能评价', async () => {
    const coach = await createTestUser({ nickname: '教练未结束open', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员未结束open' });
    const city = await createTestCity({ name: '深圳open' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-gc-l2-open' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 发布团课
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: 'open状态评价测试',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
      });

    const gcId = createRes.body.data.id;

    // 报名
    await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    // 尝试评价（此时团课还在 open 状态）
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gcId,
        rating: 5,
      });

    expect(reviewRes.status).toBe(409);
    expect(reviewRes.body.error.code).toBe('REVIEW_COURSE_NOT_COMPLETED');
  });

  it('团课状态为 in_progress 时不能评价', async () => {
    const coach = await createTestUser({ nickname: '教练未结束ing', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员未结束ing' });
    const city = await createTestCity({ name: '深圳ing' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-gc-l2-ing' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 发布团课并报名
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: '进行中评价测试',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
      });

    const gcId = createRes.body.data.id;

    await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    // 将状态设为 in_progress
    await prisma.groupClass.update({
      where: { id: gcId },
      data: {
        startTime: pastDate(1),
        endTime: futureDate(1),
        status: 'in_progress',
      },
    });

    // 尝试评价
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gcId,
        rating: 4,
      });

    expect(reviewRes.status).toBe(409);
    expect(reviewRes.body.error.code).toBe('REVIEW_COURSE_NOT_COMPLETED');
  });

  it('团课状态为 cancelled 时不能评价', async () => {
    const coach = await createTestUser({ nickname: '教练已取消', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员已取消' });
    const city = await createTestCity({ name: '深圳cancel' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-gc-l2-cancel' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 发布团课并报名
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: '已取消评价测试',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
      });

    const gcId = createRes.body.data.id;

    await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    // 取消团课
    await request(app)
      .post(`/api/group-classes/${gcId}/cancel`)
      .set('Authorization', `Bearer ${coachToken}`);

    // 尝试评价
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gcId,
        rating: 5,
      });

    expect(reviewRes.status).toBe(409);
    expect(reviewRes.body.error.code).toBe('REVIEW_COURSE_NOT_COMPLETED');
  });
});

// =============================================================================
// 异常流程: 课程未结束时录入战绩拦截
// =============================================================================

describe('异常路径: 课程未结束时录入战绩拦截', () => {
  it('团课状态为 open 时不能录入战绩', async () => {
    const coach = await createTestUser({ nickname: '教练战绩open', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员战绩open' });
    const city = await createTestCity({ name: '深圳mr' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-gc-l2-mr' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 发布团课并报名
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: 'open战绩测试',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
      });

    const gcId = createRes.body.data.id;

    await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    // 尝试录入战绩
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        sourceType: 'group-class',
        sourceId: gcId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: student.id }],
          sideB: [{ userId: coach.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(409);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_SOURCE_NOT_COMPLETED');
  });
});

// =============================================================================
// 异常流程: 非参与者不能评价
// =============================================================================

describe('异常路径: 非参与者不能评价', () => {
  it('未报名学员不能评价已结束的团课', async () => {
    const coach = await createTestUser({ nickname: '教练非参与', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const enrolledStudent = await createTestUser({ nickname: '已报名学员' });
    const outsider = await createTestUser({ nickname: '路人甲' });
    const city = await createTestCity({ name: '深圳np' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-gc-l2-np' });

    const coachToken = signToken(coach.id);
    const enrolledToken = signToken(enrolledStudent.id);
    const outsiderToken = signToken(outsider.id);

    // 发布团课，已报名学员报名
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: '非参与者评价测试',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
      });

    const gcId = createRes.body.data.id;

    await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${enrolledToken}`);

    // 团课变为已结束
    await prisma.groupClass.update({
      where: { id: gcId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 路人甲尝试评价
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gcId,
        rating: 5,
      });

    expect(reviewRes.status).toBe(403);
    expect(reviewRes.body.error.code).toBe('REVIEW_NOT_PARTICIPANT');
  });
});

// =============================================================================
// 复合流程: 多个团课的评价聚合计算
// =============================================================================

describe('复合路径: 多个团课评价影响教练平均评分', () => {
  it('来自不同团课的评价正确聚合到教练平均评分中', async () => {
    const coach = await createTestUser({ nickname: '多课教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id, specialties: ['doubles'] });
    const student1 = await createTestUser({ nickname: '聚合学员1' });
    const student2 = await createTestUser({ nickname: '聚合学员2' });

    const coachToken = signToken(coach.id);
    const student1Token = signToken(student1.id);
    const student2Token = signToken(student2.id);

    const city = await createTestCity({ name: '深圳agg' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-gc-l2-agg' });

    // 发布两个团课
    const gc1Res = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: '聚合团课1',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 10,
      });

    const gc2Res = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: '聚合团课2',
        startTime: futureDate(48).toISOString(),
        endTime: futureDate(50).toISOString(),
        maxParticipants: 10,
      });

    const gc1Id = gc1Res.body.data.id;
    const gc2Id = gc2Res.body.data.id;

    // 学员分别报名不同团课
    await request(app)
      .post(`/api/group-classes/${gc1Id}/enroll`)
      .set('Authorization', `Bearer ${student1Token}`);

    await request(app)
      .post(`/api/group-classes/${gc2Id}/enroll`)
      .set('Authorization', `Bearer ${student2Token}`);

    // 两个团课都变为已结束
    await prisma.groupClass.updateMany({
      where: { id: { in: [gc1Id, gc2Id] } },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 学员1 给 5 分
    const r1 = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc1Id,
        rating: 5,
        comment: '太棒了',
      });
    expect(r1.status).toBe(201);

    // 学员2 给 3 分
    const r2 = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        coachId: coach.id,
        courseType: 'group-class',
        courseId: gc2Id,
        rating: 3,
        comment: '一般般',
      });
    expect(r2.status).toBe(201);

    // 验证教练平均评分: (5 + 3) / 2 = 4.0
    const ratingRes = await request(app)
      .get(`/api/coaches/${coach.id}/rating`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(ratingRes.status).toBe(200);
    expect(ratingRes.body.data).toEqual({
      coachId: coach.id,
      averageRating: 4.0,
      totalCount: 2,
    });

    // 验证批量评分查询
    const batchRatingRes = await request(app)
      .post('/api/coaches/ratings')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ coachIds: [coach.id] });

    expect(batchRatingRes.status).toBe(200);
    expect(batchRatingRes.body.data.ratings[0]).toEqual({
      coachId: coach.id,
      averageRating: 4.0,
      totalCount: 2,
    });
  });
});

// =============================================================================
// 满员流程: 满员联动与状态还原
// =============================================================================

describe('关键路径: 团课满员联动', () => {
  it('报名达到上限自动 full，取消报名恢复 open', async () => {
    const coach = await createTestUser({ nickname: '满员教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student1 = await createTestUser({ nickname: '满员学员1' });
    const student2 = await createTestUser({ nickname: '满员学员2' });

    const coachToken = signToken(coach.id);
    const student1Token = signToken(student1.id);
    const student2Token = signToken(student2.id);

    const city = await createTestCity({ name: '深圳full' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-gc-l2-full' });

    // 发布只允许 2 人的团课
    const createRes = await request(app)
      .post('/api/group-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        title: '满员测试课',
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
        maxParticipants: 2,
      });

    const gcId = createRes.body.data.id;

    // 第一个学员报名
    const enroll1 = await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(enroll1.status).toBe(200);
    expect(enroll1.body.data.status).toBe('open');
    expect(enroll1.body.data.currentParticipants).toBe(1);

    // 第二个学员报名 → 满员
    const enroll2 = await request(app)
      .post(`/api/group-classes/${gcId}/enroll`)
      .set('Authorization', `Bearer ${student2Token}`);

    expect(enroll2.status).toBe(200);
    expect(enroll2.body.data.status).toBe('full');
    expect(enroll2.body.data.currentParticipants).toBe(2);

    // 第一个学员取消报名 → 恢复 open
    const cancelRes = await request(app)
      .post(`/api/group-classes/${gcId}/cancel-enrollment`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('open');
    expect(cancelRes.body.data.currentParticipants).toBe(1);
  });
});
