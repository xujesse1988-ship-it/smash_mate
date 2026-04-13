/**
 * L2 跨模块集成测试: 固定私教课程 → 战绩关键路径
 * 关键路径: 添加私教学员 → 创建课程 → 课程状态流转 → 录入战绩（对手可为任意用户）→ 验证统计
 *
 * 涉及模块: user, venue, coaching, match-record, notification
 * 测试层级: 真实模块间调用（不 Mock 其他模块），真实 PostgreSQL 测试库
 *
 * 对应 Issue: #88
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
// 正常流程: 固定私教课程 → 战绩
// =============================================================================

describe('关键路径: 固定私教课程全流程（添加学员→排课→状态流转→录入战绩→验证统计）', () => {
  it('完整正常流程: 添加私教学员 → 创建课程 → 课程进行中 → 录入战绩（对手为任意用户）→ 验证战绩和统计', async () => {
    // -----------------------------------------------------------------------
    // Step 1: 准备测试数据 — 创建教练、私教学员、对手用户和球馆
    // -----------------------------------------------------------------------
    const coach = await createTestUser({ nickname: '私教教练李', isCoach: true });
    await createTestCoachProfile({ userId: coach.id, specialties: ['singles', 'doubles'] });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert1.jpg'], status: 'approved' },
    });
    const student = await createTestUser({ nickname: '私教学员小王' });
    const opponent = await createTestUser({ nickname: '对手小赵' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '海淀羽毛球馆',
      mapPoiId: 'poi-plv2-l2-1',
    });

    const coachToken = signToken(coach.id);

    // -----------------------------------------------------------------------
    // Step 2: 教练添加固定私教学员（coaching 模块 — POST /api/private-students）
    //         验证跨模块通知：添加学员时通知学员
    // -----------------------------------------------------------------------
    const addStudentRes = await request(app)
      .post('/api/private-students')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student.id });

    expect(addStudentRes.status).toBe(201);
    expect(addStudentRes.body.data.studentId).toBe(student.id);
    expect(addStudentRes.body.data.coachId).toBe(coach.id);
    expect(addStudentRes.body.data.isActive).toBe(true);

    const privateStudentId = addStudentRes.body.data.id;

    // 验证通知: 学员收到"添加为固定私教学员"通知
    const addNotification = await prisma.notification.findFirst({
      where: { userId: student.id, type: 'PRIVATE_STUDENT_ADDED' },
    });
    expect(addNotification).not.toBeNull();

    // -----------------------------------------------------------------------
    // Step 3: 教练为学员创建私教课程（coaching 模块 — POST /api/private-students/:id/lessons）
    //         验证跨模块通知：创建课程时通知学员
    // -----------------------------------------------------------------------
    const createLessonRes = await request(app)
      .post(`/api/private-students/${privateStudentId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        trainingContent: '单打战术训练',
      });

    expect(createLessonRes.status).toBe(201);
    expect(createLessonRes.body.data.status).toBe('scheduled');
    expect(createLessonRes.body.data.trainingContent).toBe('单打战术训练');

    const lessonId = createLessonRes.body.data.id;

    // 验证通知: 学员收到"新私教课程"通知
    const lessonNotification = await prisma.notification.findFirst({
      where: { userId: student.id, type: 'PRIVATE_LESSON_V2_CREATED', targetId: lessonId },
    });
    expect(lessonNotification).not.toBeNull();

    // -----------------------------------------------------------------------
    // Step 4: 模拟课程状态流转到"进行中"
    // -----------------------------------------------------------------------
    await prisma.privateLessonV2.update({
      where: { id: lessonId },
      data: {
        startTime: pastDate(2),
        endTime: futureDate(2), // 还没结束
      },
    });

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

    // 验证课程状态已变为 in_progress
    const lessonAfterTransition = await prisma.privateLessonV2.findUnique({
      where: { id: lessonId },
    });
    expect(lessonAfterTransition!.status).toBe('in_progress');

    // -----------------------------------------------------------------------
    // Step 5: 教练录入战绩 — 对手为任意平台用户（非私教学员关系内的人）
    //         跨模块调用: match-record → coaching（校验课程状态 + 参与者）
    //         关键点: private_lesson_v2 不限制对手范围
    // -----------------------------------------------------------------------
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        sourceType: 'private_lesson_v2',
        sourceId: lessonId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: student.id }],
          sideB: [{ userId: opponent.id }],
        },
        games: [
          { scoreA: 21, scoreB: 15 },
          { scoreA: 21, scoreB: 18 },
        ],
      });

    expect(recordRes.status).toBe(201);
    expect(recordRes.body.data.sourceType).toBe('private_lesson_v2');
    expect(recordRes.body.data.sourceId).toBe(lessonId);
    expect(recordRes.body.data.matchType).toBe('singles');
    expect(recordRes.body.data.recordedBy).toBe(coach.id);
    expect(recordRes.body.data.result).toBe('A_WIN'); // student wins 2-0
    expect(recordRes.body.data.games).toHaveLength(2);

    const matchRecordId = recordRes.body.data.id;

    // -----------------------------------------------------------------------
    // Step 6: 查看课程战绩列表（match-record 模块 — GET /api/private-lessons-v2/:id/match-records）
    // -----------------------------------------------------------------------
    const listRes = await request(app)
      .get(`/api/private-lessons-v2/${lessonId}/match-records`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].id).toBe(matchRecordId);
    expect(listRes.body.data.items[0].result).toBe('A_WIN');

    // -----------------------------------------------------------------------
    // Step 7: 验证双方用户个人战绩汇总
    // -----------------------------------------------------------------------
    const studentToken = signToken(student.id);
    const studentStatsRes = await request(app)
      .get(`/api/users/${student.id}/match-stats`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(studentStatsRes.status).toBe(200);
    expect(studentStatsRes.body.data.totalMatches).toBe(1);
    expect(studentStatsRes.body.data.wins).toBe(1);
    expect(studentStatsRes.body.data.losses).toBe(0);

    const opponentToken = signToken(opponent.id);
    const opponentStatsRes = await request(app)
      .get(`/api/users/${opponent.id}/match-stats`)
      .set('Authorization', `Bearer ${opponentToken}`);

    expect(opponentStatsRes.status).toBe(200);
    expect(opponentStatsRes.body.data.totalMatches).toBe(1);
    expect(opponentStatsRes.body.data.wins).toBe(0);
    expect(opponentStatsRes.body.data.losses).toBe(1);
  });
});

// =============================================================================
// 异常流程和补充场景
// =============================================================================

describe('异常流程: 固定私教课程战绩录入约束', () => {
  it('课程状态为 scheduled 时不可录入战绩，返回 MATCH_RECORD_LESSON_NOT_STARTED', async () => {
    // 准备数据
    const coach = await createTestUser({ nickname: '教练F', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const student = await createTestUser({ nickname: '私教学员F' });
    const opponent = await createTestUser({ nickname: '对手F' });
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-plv2-l2-2' });
    const coachToken = signToken(coach.id);

    // 添加私教学员
    const addRes = await request(app)
      .post('/api/private-students')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student.id });
    const privateStudentId = addRes.body.data.id;

    // 创建课程（状态为 scheduled）
    const lessonRes = await request(app)
      .post(`/api/private-students/${privateStudentId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
      });
    const lessonId = lessonRes.body.data.id;

    // 尝试在 scheduled 状态录入战绩
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        sourceType: 'private_lesson_v2',
        sourceId: lessonId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: student.id }],
          sideB: [{ userId: opponent.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(409);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_LESSON_NOT_STARTED');
  });

  it('移除私教学员后不能创建新课程，但已有数据保留', async () => {
    const coach = await createTestUser({ nickname: '教练G', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const student = await createTestUser({ nickname: '被移除学员' });
    const city = await createTestCity({ name: '广州' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-plv2-l2-3' });
    const coachToken = signToken(coach.id);

    // 添加私教学员
    const addRes = await request(app)
      .post('/api/private-students')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student.id });
    const privateStudentId = addRes.body.data.id;

    // 创建一节课程
    const lessonRes = await request(app)
      .post(`/api/private-students/${privateStudentId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        trainingContent: '移除前的训练',
      });
    expect(lessonRes.status).toBe(201);

    // 移除学员（软删除）
    const removeRes = await request(app)
      .delete(`/api/private-students/${privateStudentId}`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data.isActive).toBe(false);

    // 验证移除通知
    const removeNotification = await prisma.notification.findFirst({
      where: { userId: student.id, type: 'PRIVATE_STUDENT_REMOVED' },
    });
    expect(removeNotification).not.toBeNull();

    // 尝试为已移除学员创建新课程 — 应失败
    const newLessonRes = await request(app)
      .post(`/api/private-students/${privateStudentId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(24).toISOString(),
        endTime: futureDate(26).toISOString(),
      });

    expect(newLessonRes.status).toBe(409);
    expect(newLessonRes.body.error.code).toBe('COACHING_STUDENT_INACTIVE');

    // 验证已有课程数据保留
    const lessons = await request(app)
      .get(`/api/private-students/${privateStudentId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(lessons.status).toBe(200);
    expect(lessons.body.data.items).toHaveLength(1);
    expect(lessons.body.data.items[0].trainingContent).toBe('移除前的训练');
  });

  it('课程笔记和训练内容在非取消状态下正常工作', async () => {
    const coach = await createTestUser({ nickname: '教练H', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const student = await createTestUser({ nickname: '笔记测试学员' });
    const city = await createTestCity({ name: '深圳' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-plv2-l2-4' });
    const coachToken = signToken(coach.id);

    // 添加私教学员并创建课程
    const addRes = await request(app)
      .post('/api/private-students')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student.id });
    const privateStudentId = addRes.body.data.id;

    const lessonRes = await request(app)
      .post(`/api/private-students/${privateStudentId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        trainingContent: '初始训练内容',
      });
    const lessonId = lessonRes.body.data.id;

    // 在 scheduled 状态下添加笔记
    const noteRes1 = await request(app)
      .post(`/api/private-students/${privateStudentId}/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: '课前准备笔记' });

    expect(noteRes1.status).toBe(201);

    // 将课程设为进行中
    await prisma.privateLessonV2.update({
      where: { id: lessonId },
      data: { startTime: pastDate(2), endTime: futureDate(2), status: 'in_progress' },
    });

    // 更新训练内容
    const updateContentRes = await request(app)
      .put(`/api/private-students/${privateStudentId}/lessons/${lessonId}/training-content`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ trainingContent: '调整为双打站位训练' });

    expect(updateContentRes.status).toBe(200);

    // 在 in_progress 状态下添加笔记
    const noteRes2 = await request(app)
      .post(`/api/private-students/${privateStudentId}/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: '课中表现不错' });

    expect(noteRes2.status).toBe(201);

    // 查看笔记列表
    const notesRes = await request(app)
      .get(`/api/private-students/${privateStudentId}/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(notesRes.status).toBe(200);
    expect(notesRes.body.data.items).toHaveLength(2);
  });

  it('学员笔记和标签在移除后仍保留', async () => {
    const coach = await createTestUser({ nickname: '教练I', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const student = await createTestUser({ nickname: '标签保留学员' });
    const coachToken = signToken(coach.id);

    // 添加私教学员
    const addRes = await request(app)
      .post('/api/private-students')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student.id });
    const privateStudentId = addRes.body.data.id;

    // 添加学员笔记
    const noteRes = await request(app)
      .post(`/api/private-students/${privateStudentId}/notes`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: '学员力量不错，需加强灵活性' });

    expect(noteRes.status).toBe(201);

    // 设置学员标签
    const tagsRes = await request(app)
      .put(`/api/private-students/${privateStudentId}/tags`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ tags: ['右手', '力量型', '需加强灵活性'] });

    expect(tagsRes.status).toBe(200);
    expect(tagsRes.body.data.tags).toHaveLength(3);
    expect(tagsRes.body.data.tags).toContain('右手');
    expect(tagsRes.body.data.tags).toContain('力量型');
    expect(tagsRes.body.data.tags).toContain('需加强灵活性');

    // 移除学员
    await request(app)
      .delete(`/api/private-students/${privateStudentId}`)
      .set('Authorization', `Bearer ${coachToken}`);

    // 验证笔记仍可查看
    const notesAfterRemoval = await request(app)
      .get(`/api/private-students/${privateStudentId}/notes`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(notesAfterRemoval.status).toBe(200);
    expect(notesAfterRemoval.body.data.items).toHaveLength(1);
    expect(notesAfterRemoval.body.data.items[0].content).toBe('学员力量不错，需加强灵活性');

    // 验证标签仍可查看
    const tagsAfterRemoval = await request(app)
      .get(`/api/private-students/${privateStudentId}/tags`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(tagsAfterRemoval.status).toBe(200);
    expect(tagsAfterRemoval.body.data.tags).toHaveLength(3);
    expect(tagsAfterRemoval.body.data.tags).toContain('右手');
    expect(tagsAfterRemoval.body.data.tags).toContain('力量型');
  });
});
