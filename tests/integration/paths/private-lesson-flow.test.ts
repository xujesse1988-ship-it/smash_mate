/**
 * L2 跨模块集成测试: 私教预约全流程
 * 关键路径: 设置空闲时间 → 学员预约 → 时间段锁定 → 取消预约 → 时间段释放 → 重新预约 → 课程结束 → 评价
 *
 * 涉及模块: user, venue, coaching, review, notification
 * 测试层级: 真实模块间调用（不 Mock 其他模块），真实 PostgreSQL 测试库
 *
 * 对应 Issue: #57
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
// 正常流程: 私教预约全生命周期
// =============================================================================

describe('关键路径: 私教预约全流程（设置空闲→预约→取消→重新预约→结束→评价）', () => {
  it('完整正常流程: 教练设置空闲时间 → 学员预约 → 时间段锁定 → 学员取消 → 时间段释放 → 重新预约 → 课程结束 → 提交评价 → 评分更新', async () => {
    // -----------------------------------------------------------------------
    // Step 1: 准备测试数据 — 创建教练、学员和球馆
    // -----------------------------------------------------------------------
    const coach = await createTestUser({ nickname: '私教教练王', isCoach: true });
    await createTestCoachProfile({ userId: coach.id, specialties: ['singles', 'footwork'] });
    const student = await createTestUser({ nickname: '学员小李' });
    const city = await createTestCity({ name: '北京' });
    const venue1 = await createTestVenue({
      cityId: city.id,
      name: '朝阳体育中心',
      mapPoiId: 'poi-pl-l2-1',
    });
    const venue2 = await createTestVenue({
      cityId: city.id,
      name: '海淀羽毛球馆',
      mapPoiId: 'poi-pl-l2-2',
    });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // -----------------------------------------------------------------------
    // Step 2: 教练设置空闲时间（coaching 模块 — POST /api/private-lessons/availability）
    //         包含可选球馆列表
    // -----------------------------------------------------------------------
    const slot1Start = futureDate(48);
    const slot1End = futureDate(50);
    const slot2Start = futureDate(72);
    const slot2End = futureDate(74);

    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: slot1Start.toISOString(),
            endTime: slot1End.toISOString(),
            venueIds: [venue1.id, venue2.id],
            feeDescription: '300元/小时',
          },
          {
            startTime: slot2Start.toISOString(),
            endTime: slot2End.toISOString(),
            venueIds: [],
            feeDescription: '250元/小时',
          },
        ],
      });

    expect(availRes.status).toBe(201);
    expect(availRes.body.data.slots).toHaveLength(2);
    expect(availRes.body.data.slots[0].isBooked).toBe(false);
    expect(availRes.body.data.slots[1].isBooked).toBe(false);

    const slot1Id = availRes.body.data.slots[0].id;
    const slot2Id = availRes.body.data.slots[1].id;

    // -----------------------------------------------------------------------
    // Step 3: 验证教练空闲时间可查询（coaching 模块 — GET /api/coaches/:id/availability）
    // -----------------------------------------------------------------------
    const availQueryRes = await request(app)
      .get(`/api/coaches/${coach.id}/availability`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(availQueryRes.status).toBe(200);
    expect(availQueryRes.body.data.slots.length).toBeGreaterThanOrEqual(2);

    // 时间段 1 应包含 venue 信息
    const queriedSlot1 = availQueryRes.body.data.slots.find(
      (s: { id: string }) => s.id === slot1Id,
    );
    expect(queriedSlot1).toBeDefined();
    expect(queriedSlot1.isBooked).toBe(false);
    expect(queriedSlot1.venues).toHaveLength(2);

    // -----------------------------------------------------------------------
    // Step 4: 学员预约第一个时间段（coaching 模块 — POST /api/private-lessons/book）
    //         跨模块通知：预约时通知教练（coaching → notification）
    // -----------------------------------------------------------------------
    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        slotId: slot1Id,
        venueId: venue1.id,
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.data.slotId).toBe(slot1Id);
    expect(bookRes.body.data.coachId).toBe(coach.id);
    expect(bookRes.body.data.studentId).toBe(student.id);
    expect(bookRes.body.data.status).toBe('scheduled');
    expect(bookRes.body.data.venue).toBeDefined();
    expect(bookRes.body.data.venue.name).toBe('朝阳体育中心');

    const lesson1Id = bookRes.body.data.id;

    // 验证通知: 教练收到"新私教预约"通知（coaching → notification 跨模块调用）
    const bookNotification = await prisma.notification.findFirst({
      where: { userId: coach.id, type: 'PRIVATE_LESSON_BOOKED' },
    });
    expect(bookNotification).not.toBeNull();
    expect(bookNotification!.content).toContain('学员小李');
    expect(bookNotification!.title).toBe('新私教预约');
    expect(bookNotification!.targetType).toBe('private-lesson');
    expect(bookNotification!.targetId).toBe(lesson1Id);

    // -----------------------------------------------------------------------
    // Step 5: 验证时间段已被锁定 — 再次查询空闲时间
    // -----------------------------------------------------------------------
    const availAfterBook = await request(app)
      .get(`/api/coaches/${coach.id}/availability`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(availAfterBook.status).toBe(200);
    const bookedSlot = availAfterBook.body.data.slots.find((s: { id: string }) => s.id === slot1Id);
    expect(bookedSlot.isBooked).toBe(true);

    // -----------------------------------------------------------------------
    // Step 6: 学员取消预约（coaching 模块 — POST /api/private-lessons/:id/cancel）
    //         跨模块通知：学员取消时通知教练（coaching → notification）
    // -----------------------------------------------------------------------
    const cancelRes = await request(app)
      .post(`/api/private-lessons/${lesson1Id}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // 验证通知: 教练收到"学员取消私教"通知
    const cancelNotification = await prisma.notification.findFirst({
      where: { userId: coach.id, type: 'PRIVATE_LESSON_CANCELLED_BY_STUDENT' },
    });
    expect(cancelNotification).not.toBeNull();
    expect(cancelNotification!.content).toContain('学员小李');
    expect(cancelNotification!.title).toBe('学员取消私教');
    expect(cancelNotification!.targetType).toBe('private-lesson');
    expect(cancelNotification!.targetId).toBe(lesson1Id);

    // -----------------------------------------------------------------------
    // Step 7: 验证时间段已释放 — 再次查询空闲时间
    // -----------------------------------------------------------------------
    const availAfterCancel = await request(app)
      .get(`/api/coaches/${coach.id}/availability`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(availAfterCancel.status).toBe(200);
    const releasedSlot = availAfterCancel.body.data.slots.find(
      (s: { id: string }) => s.id === slot1Id,
    );
    expect(releasedSlot.isBooked).toBe(false);

    // -----------------------------------------------------------------------
    // Step 8: 学员预约第二个时间段（不限地点的时间段）
    //         验证取消第一个预约后仍可预约其他时间段
    // -----------------------------------------------------------------------
    const rebookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        slotId: slot2Id,
        // slot2 不限地点（venueIds 为空），不需要提供 venueId
      });

    expect(rebookRes.status).toBe(201);
    expect(rebookRes.body.data.status).toBe('scheduled');
    expect(rebookRes.body.data.slotId).toBe(slot2Id);

    const lesson2Id = rebookRes.body.data.id;

    // -----------------------------------------------------------------------
    // Step 9: 私教课状态流转到已完成
    //         模拟时间流逝：直接将时间设为过去，再调用状态流转定时任务
    // -----------------------------------------------------------------------
    await prisma.privateLessonSlot.update({
      where: { id: slot2Id },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
      },
    });
    await prisma.privateLesson.update({
      where: { id: lesson2Id },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'in_progress', // scheduled → in_progress (模拟开始时间已过)
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

    // 验证私教课状态已变为 completed
    const lessonAfterTransition = await prisma.privateLesson.findUnique({
      where: { id: lesson2Id },
    });
    expect(lessonAfterTransition!.status).toBe('completed');

    // -----------------------------------------------------------------------
    // Step 10: 学员提交评价（review 模块 — POST /api/reviews）
    //          跨模块调用: review → coaching（校验参与关系 + 课程状态）
    //                      review → notification（通知教练）
    //                      review → user（获取学员昵称用于通知文案）
    // -----------------------------------------------------------------------
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        coachId: coach.id,
        courseType: 'private-lesson',
        courseId: lesson2Id,
        rating: 5,
        comment: '私教教学非常专业，针对性指导很有帮助！',
      });

    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.data).toMatchObject({
      reviewerId: student.id,
      coachId: coach.id,
      courseType: 'private-lesson',
      courseId: lesson2Id,
      rating: 5,
      comment: '私教教学非常专业，针对性指导很有帮助！',
    });

    // 验证通知: 教练收到"收到新评价"通知（review → notification 跨模块调用）
    const reviewNotification = await prisma.notification.findFirst({
      where: { userId: coach.id, type: 'REVIEW_RECEIVED' },
    });
    expect(reviewNotification).not.toBeNull();
    expect(reviewNotification!.title).toBe('收到新评价');
    expect(reviewNotification!.content).toContain('学员小李');
    expect(reviewNotification!.targetType).toBe('coach-profile');
    expect(reviewNotification!.targetId).toBe(coach.id);

    // -----------------------------------------------------------------------
    // Step 11: 验证教练评分正确更新（review 模块 — GET /api/coaches/:id/rating）
    // -----------------------------------------------------------------------
    const ratingRes = await request(app)
      .get(`/api/coaches/${coach.id}/rating`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(ratingRes.status).toBe(200);
    expect(ratingRes.body.data).toEqual({
      coachId: coach.id,
      averageRating: 5.0,
      totalCount: 1,
    });

    // -----------------------------------------------------------------------
    // Step 12: 验证教练评价列表包含评价（review 模块 — GET /api/coaches/:id/reviews）
    // -----------------------------------------------------------------------
    const reviewListRes = await request(app)
      .get(`/api/coaches/${coach.id}/reviews`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(reviewListRes.status).toBe(200);
    expect(reviewListRes.body.data.total).toBe(1);
    expect(reviewListRes.body.data.items[0].rating).toBe(5);
    expect(reviewListRes.body.data.items[0].courseType).toBe('private-lesson');
    expect(reviewListRes.body.data.items[0].reviewer.nickname).toBe('学员小李');
  });

  it('教练取消预约流程: 教练取消 → 通知学员 → 时间段释放', async () => {
    // 准备数据
    const coach = await createTestUser({ nickname: '取消教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '被取消学员' });
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '浦东体育馆',
      mapPoiId: 'poi-pl-l2-coach-cancel',
    });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 教练设置空闲时间
    const slotStart = futureDate(48);
    const slotEnd = futureDate(50);

    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            venueIds: [venue.id],
            feeDescription: '200元/小时',
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    // 学员预约
    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        slotId,
        venueId: venue.id,
      });

    expect(bookRes.status).toBe(201);
    const lessonId = bookRes.body.data.id;

    // 教练取消预约
    const cancelRes = await request(app)
      .post(`/api/private-lessons/${lessonId}/cancel`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // 验证通知: 学员收到"教练取消私教"通知（coaching → notification）
    const cancelNotification = await prisma.notification.findFirst({
      where: { userId: student.id, type: 'PRIVATE_LESSON_CANCELLED_BY_COACH' },
    });
    expect(cancelNotification).not.toBeNull();
    expect(cancelNotification!.title).toBe('教练取消私教');
    expect(cancelNotification!.content).toContain('教练取消了你的私教课预约');
    expect(cancelNotification!.targetType).toBe('coach-profile');
    expect(cancelNotification!.targetId).toBe(coach.id);

    // 验证时间段已释放
    const slot = await prisma.privateLessonSlot.findUnique({
      where: { id: slotId },
    });
    expect(slot!.isBooked).toBe(false);
  });
});

// =============================================================================
// 异常流程: 时间段冲突
// =============================================================================

describe('异常路径: 时间段冲突', () => {
  it('已被预约的时间段不能被再次预约', async () => {
    const coach = await createTestUser({ nickname: '冲突教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student1 = await createTestUser({ nickname: '先到学员' });
    const student2 = await createTestUser({ nickname: '后到学员' });
    const city = await createTestCity({ name: '深圳冲突' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-conflict' });

    const coachToken = signToken(coach.id);
    const student1Token = signToken(student1.id);
    const student2Token = signToken(student2.id);

    // 设置空闲时间
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    // 学员1 先预约成功
    const book1Res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ slotId, venueId: venue.id });

    expect(book1Res.status).toBe(201);

    // 学员2 再预约同一时间段被拒绝
    const book2Res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ slotId, venueId: venue.id });

    expect(book2Res.status).toBe(409);
    expect(book2Res.body.error.code).toBe('COACHING_SLOT_ALREADY_BOOKED');
  });

  it('设置空闲时间时，时间段不能与已有时间段重叠', async () => {
    const coach = await createTestUser({ nickname: '重叠教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });

    const coachToken = signToken(coach.id);

    // 设置第一个空闲时间段
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
          },
        ],
      });

    expect(availRes.status).toBe(201);

    // 设置重叠的时间段 — 应该被拒绝
    const overlapRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(49).toISOString(), // 与第一个时间段重叠
            endTime: futureDate(51).toISOString(),
          },
        ],
      });

    expect(overlapRes.status).toBe(409);
    expect(overlapRes.body.error.code).toBe('COACHING_SLOT_OVERLAP');
  });
});

// =============================================================================
// 异常流程: 预约已取消的私教课不能再取消
// =============================================================================

describe('异常路径: 已取消私教课的幂等性', () => {
  it('已取消的私教课重复取消应幂等返回（不报错）', async () => {
    const coach = await createTestUser({ nickname: '幂等教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '幂等学员' });
    const city = await createTestCity({ name: '广州幂等' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-idempotent' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置空闲时间
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    // 预约
    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId, venueId: venue.id });

    const lessonId = bookRes.body.data.id;

    // 第一次取消
    const cancel1 = await request(app)
      .post(`/api/private-lessons/${lessonId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(cancel1.status).toBe(200);
    expect(cancel1.body.data.status).toBe('cancelled');

    // 第二次取消 — 应幂等返回，不报错
    const cancel2 = await request(app)
      .post(`/api/private-lessons/${lessonId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(cancel2.status).toBe(200);
    expect(cancel2.body.data.status).toBe('cancelled');
  });
});

// =============================================================================
// 异常流程: 进行中/已完成的私教课不能取消
// =============================================================================

describe('异常路径: 不可取消状态的私教课', () => {
  it('进行中的私教课不能取消', async () => {
    const coach = await createTestUser({ nickname: '进行教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '进行学员' });
    const city = await createTestCity({ name: '杭州进行' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-inprog' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置空闲时间并预约
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId, venueId: venue.id });

    const lessonId = bookRes.body.data.id;

    // 将状态设为 in_progress
    await prisma.privateLesson.update({
      where: { id: lessonId },
      data: {
        startTime: pastDate(1),
        endTime: futureDate(1),
        status: 'in_progress',
      },
    });

    // 尝试取消
    const cancelRes = await request(app)
      .post(`/api/private-lessons/${lessonId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(cancelRes.status).toBe(409);
    expect(cancelRes.body.error.code).toBe('COACHING_LESSON_NOT_CANCELLABLE');
  });

  it('已完成的私教课不能取消', async () => {
    const coach = await createTestUser({ nickname: '完成教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '完成学员' });
    const city = await createTestCity({ name: '杭州完成' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-completed' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置空闲时间并预约
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId, venueId: venue.id });

    const lessonId = bookRes.body.data.id;

    // 将状态设为 completed
    await prisma.privateLesson.update({
      where: { id: lessonId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 尝试取消
    const cancelRes = await request(app)
      .post(`/api/private-lessons/${lessonId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(cancelRes.status).toBe(409);
    expect(cancelRes.body.error.code).toBe('COACHING_LESSON_NOT_CANCELLABLE');
  });
});

// =============================================================================
// 异常流程: 教练不能预约自己的私教课
// =============================================================================

describe('异常路径: 教练不能预约自己的私教课', () => {
  it('教练尝试预约自己的时间段被拒绝', async () => {
    const coach = await createTestUser({ nickname: '自约教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });

    const coachToken = signToken(coach.id);

    // 设置空闲时间
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    // 教练自己预约
    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ slotId });

    expect(bookRes.status).toBe(403);
    expect(bookRes.body.error.code).toBe('COACHING_CANNOT_BOOK_OWN_LESSON');
  });
});

// =============================================================================
// 异常流程: 私教课未结束时不能评价
// =============================================================================

describe('异常路径: 私教课未结束时评价拦截', () => {
  it('私教课状态为 scheduled 时不能评价', async () => {
    const coach = await createTestUser({ nickname: '未开始教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '未开始学员' });
    const city = await createTestCity({ name: '成都未开始' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-scheduled' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置空闲时间并预约
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId, venueId: venue.id });

    const lessonId = bookRes.body.data.id;

    // 尝试评价（课程还在 scheduled 状态）
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        coachId: coach.id,
        courseType: 'private-lesson',
        courseId: lessonId,
        rating: 5,
      });

    expect(reviewRes.status).toBe(409);
    expect(reviewRes.body.error.code).toBe('REVIEW_COURSE_NOT_COMPLETED');
  });

  it('私教课状态为 cancelled 时不能评价', async () => {
    const coach = await createTestUser({ nickname: '已取消评教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '已取消评学员' });
    const city = await createTestCity({ name: '成都取消评' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-cancel-rev' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置空闲时间并预约
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId, venueId: venue.id });

    const lessonId = bookRes.body.data.id;

    // 取消预约
    await request(app)
      .post(`/api/private-lessons/${lessonId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    // 尝试评价已取消的课程
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        coachId: coach.id,
        courseType: 'private-lesson',
        courseId: lessonId,
        rating: 5,
      });

    expect(reviewRes.status).toBe(409);
    expect(reviewRes.body.error.code).toBe('REVIEW_COURSE_NOT_COMPLETED');
  });
});

// =============================================================================
// 异常流程: 非参与者不能评价私教课
// =============================================================================

describe('异常路径: 非参与者不能评价私教课', () => {
  it('未预约的学员不能评价已完成的私教课', async () => {
    const coach = await createTestUser({ nickname: '非参教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '已约学员' });
    const outsider = await createTestUser({ nickname: '局外人' });
    const city = await createTestCity({ name: '南京非参' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-outsider' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);
    const outsiderToken = signToken(outsider.id);

    // 设置空闲时间并预约
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId, venueId: venue.id });

    const lessonId = bookRes.body.data.id;

    // 将课程设为已完成
    await prisma.privateLesson.update({
      where: { id: lessonId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 局外人尝试评价
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        coachId: coach.id,
        courseType: 'private-lesson',
        courseId: lessonId,
        rating: 5,
      });

    expect(reviewRes.status).toBe(403);
    expect(reviewRes.body.error.code).toBe('REVIEW_NOT_PARTICIPANT');
  });
});

// =============================================================================
// 异常流程: 重复评价拦截（私教课）
// =============================================================================

describe('异常路径: 私教课重复评价拦截', () => {
  it('同一学员对同一私教课不能评价两次', async () => {
    const coach = await createTestUser({ nickname: '重复评教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '重复评学员' });
    const city = await createTestCity({ name: '武汉重复评' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-dup-rev' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置空闲时间并预约
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId, venueId: venue.id });

    const lessonId = bookRes.body.data.id;

    // 将课程设为已完成
    await prisma.privateLesson.update({
      where: { id: lessonId },
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
        courseType: 'private-lesson',
        courseId: lessonId,
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
        courseType: 'private-lesson',
        courseId: lessonId,
        rating: 3,
        comment: '想修改评价',
      });

    expect(review2.status).toBe(409);
    expect(review2.body.error.code).toBe('REVIEW_DUPLICATE');

    // 验证评分仍然是第一次的值
    const ratingRes = await request(app)
      .get(`/api/coaches/${coach.id}/rating`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(ratingRes.status).toBe(200);
    expect(ratingRes.body.data.averageRating).toBe(5.0);
    expect(ratingRes.body.data.totalCount).toBe(1);
  });
});

// =============================================================================
// 复合流程: 多个私教课评价聚合到教练评分
// =============================================================================

describe('复合路径: 多个私教课评价影响教练平均评分', () => {
  it('来自不同私教课的评价正确聚合到教练平均评分中', async () => {
    const coach = await createTestUser({ nickname: '多课私教', isCoach: true });
    await createTestCoachProfile({ userId: coach.id, specialties: ['doubles'] });
    const student1 = await createTestUser({ nickname: '私教学员1' });
    const student2 = await createTestUser({ nickname: '私教学员2' });
    const city = await createTestCity({ name: '西安多课' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-multi' });

    const coachToken = signToken(coach.id);
    const student1Token = signToken(student1.id);
    const student2Token = signToken(student2.id);

    // 设置两个空闲时间段
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
          {
            startTime: futureDate(72).toISOString(),
            endTime: futureDate(74).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slot1Id = availRes.body.data.slots[0].id;
    const slot2Id = availRes.body.data.slots[1].id;

    // 两个学员分别预约不同时间段
    const book1Res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ slotId: slot1Id, venueId: venue.id });

    const book2Res = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ slotId: slot2Id, venueId: venue.id });

    const lesson1Id = book1Res.body.data.id;
    const lesson2Id = book2Res.body.data.id;

    // 两个课程都变为已完成
    await prisma.privateLesson.updateMany({
      where: { id: { in: [lesson1Id, lesson2Id] } },
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
        courseType: 'private-lesson',
        courseId: lesson1Id,
        rating: 5,
        comment: '非常好',
      });
    expect(r1.status).toBe(201);

    // 学员2 给 3 分
    const r2 = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        coachId: coach.id,
        courseType: 'private-lesson',
        courseId: lesson2Id,
        rating: 3,
        comment: '一般',
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

    // 验证批量评分查询也正确
    const batchRatingRes = await request(app)
      .post('/api/coaches/ratings')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ coachIds: [coach.id] });

    expect(batchRatingRes.status).toBe(200);
    expect(batchRatingRes.body.data.ratings).toHaveLength(1);
    expect(batchRatingRes.body.data.ratings[0]).toEqual({
      coachId: coach.id,
      averageRating: 4.0,
      totalCount: 2,
    });
  });
});

// =============================================================================
// 异常流程: 球馆选择校验
// =============================================================================

describe('异常路径: 预约时球馆选择校验', () => {
  it('时间段设置了可选球馆时，学员必须选择球馆', async () => {
    const coach = await createTestUser({ nickname: '球馆校验教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '球馆校验学员' });
    const city = await createTestCity({ name: '长沙球馆' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-venue-req' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置有可选球馆的空闲时间
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    // 不提供 venueId
    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId });

    expect(bookRes.status).toBe(400);
    expect(bookRes.body.error.code).toBe('COACHING_VENUE_REQUIRED');
  });

  it('学员选择的球馆不在可选列表中被拒绝', async () => {
    const coach = await createTestUser({ nickname: '不匹配教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '不匹配学员' });
    const city = await createTestCity({ name: '长沙不匹配' });
    const venue1 = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-v1' });
    const venue2 = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-pl-l2-v2' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置空闲时间，只包含 venue1
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [venue1.id],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    // 选择 venue2（不在可选列表中）
    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId, venueId: venue2.id });

    expect(bookRes.status).toBe(400);
    expect(bookRes.body.error.code).toBe('COACHING_INVALID_VENUE_CHOICE');
  });

  it('时间段不限地点时，学员可以不提供球馆预约成功', async () => {
    const coach = await createTestUser({ nickname: '不限教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '不限学员' });

    const coachToken = signToken(coach.id);
    const studentToken = signToken(student.id);

    // 设置空闲时间，不限地点（venueIds 为空）
    const availRes = await request(app)
      .post('/api/private-lessons/availability')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        slots: [
          {
            startTime: futureDate(48).toISOString(),
            endTime: futureDate(50).toISOString(),
            venueIds: [],
          },
        ],
      });

    const slotId = availRes.body.data.slots[0].id;

    // 不提供 venueId 预约
    const bookRes = await request(app)
      .post('/api/private-lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ slotId });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.data.status).toBe('scheduled');
  });
});
