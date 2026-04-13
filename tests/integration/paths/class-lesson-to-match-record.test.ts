/**
 * L2 跨模块集成测试: 学员班课程 → 战绩关键路径
 * 关键路径: 创建学员班 → 添加学员 → 创建课程 → 课程状态流转 → 录入战绩 → 验证战绩统计
 *
 * 涉及模块: user, venue, coaching, match-record, notification
 * 测试层级: 真实模块间调用（不 Mock 其他模块），真实 PostgreSQL 测试库
 *
 * 对应 Issue: #87
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
// 正常流程: 学员班课程 → 战绩
// =============================================================================

describe('关键路径: 学员班课程全流程（创建班→添加学员→排课→状态流转→录入战绩→验证统计）', () => {
  it('完整正常流程: 创建学员班 → 添加学员 → 创建课程 → 课程进行中 → 录入学员间战绩 → 验证战绩和统计', async () => {
    // -----------------------------------------------------------------------
    // Step 1: 准备测试数据 — 创建教练（含审核通过的 CoachApplication）、学员和球馆
    // -----------------------------------------------------------------------
    const coach = await createTestUser({ nickname: '教练老张', isCoach: true });
    await createTestCoachProfile({ userId: coach.id, specialties: ['singles', 'footwork'] });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert1.jpg'], status: 'approved' },
    });
    const student1 = await createTestUser({ nickname: '学员小明' });
    const student2 = await createTestUser({ nickname: '学员小红' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '朝阳体育中心',
      mapPoiId: 'poi-cl-l2-1',
    });

    const coachToken = signToken(coach.id);

    // -----------------------------------------------------------------------
    // Step 2: 教练创建学员班（coaching 模块 — POST /api/student-classes）
    // -----------------------------------------------------------------------
    const createClassRes = await request(app)
      .post('/api/student-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: '周三进阶班' });

    expect(createClassRes.status).toBe(201);
    expect(createClassRes.body.data.name).toBe('周三进阶班');
    expect(createClassRes.body.data.memberCount).toBe(0);

    const classId = createClassRes.body.data.id;

    // -----------------------------------------------------------------------
    // Step 3: 添加两名学员（coaching 模块 — POST /api/student-classes/:id/members）
    //         验证跨模块通知：添加学员时通知学员（coaching → notification）
    // -----------------------------------------------------------------------
    const addStudent1Res = await request(app)
      .post(`/api/student-classes/${classId}/members`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student1.id });

    expect(addStudent1Res.status).toBe(201);
    expect(addStudent1Res.body.data.studentId).toBe(student1.id);

    const addStudent2Res = await request(app)
      .post(`/api/student-classes/${classId}/members`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student2.id });

    expect(addStudent2Res.status).toBe(201);
    expect(addStudent2Res.body.data.studentId).toBe(student2.id);

    // 验证通知: 学员收到"加入学员班"通知（coaching → notification 跨模块调用）
    const student1Notification = await prisma.notification.findFirst({
      where: { userId: student1.id, type: 'STUDENT_CLASS_ADDED' },
    });
    expect(student1Notification).not.toBeNull();
    expect(student1Notification!.content).toContain('教练老张');
    expect(student1Notification!.content).toContain('周三进阶班');

    // -----------------------------------------------------------------------
    // Step 4: 教练创建课程（coaching 模块 — POST /api/student-classes/:id/lessons）
    //         验证跨模块通知：创建课程时通知所有学员
    // -----------------------------------------------------------------------
    const createLessonRes = await request(app)
      .post(`/api/student-classes/${classId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        trainingContent: '今天练习步法和高远球',
      });

    expect(createLessonRes.status).toBe(201);
    expect(createLessonRes.body.data.status).toBe('scheduled');
    expect(createLessonRes.body.data.trainingContent).toBe('今天练习步法和高远球');

    const lessonId = createLessonRes.body.data.id;

    // 验证通知: 学员收到"新课程安排"通知
    const lessonNotifications = await prisma.notification.findMany({
      where: { type: 'CLASS_LESSON_CREATED', targetId: lessonId },
    });
    expect(lessonNotifications.length).toBe(2); // 两名学员各收到一条

    // -----------------------------------------------------------------------
    // Step 5: 模拟课程状态流转到"进行中"
    //         直接更新数据库时间为过去，再调用 processStatusTransitions
    // -----------------------------------------------------------------------
    await prisma.classLesson.update({
      where: { id: lessonId },
      data: {
        startTime: pastDate(2),
        endTime: futureDate(2), // 还没结束
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

    // 验证课程状态已变为 in_progress
    const lessonAfterTransition = await prisma.classLesson.findUnique({
      where: { id: lessonId },
    });
    expect(lessonAfterTransition!.status).toBe('in_progress');

    // -----------------------------------------------------------------------
    // Step 6: 教练录入学员间战绩（match-record 模块 — POST /api/match-records）
    //         跨模块调用: match-record → coaching（校验参与关系 + 课程状态）
    // -----------------------------------------------------------------------
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        sourceType: 'class_lesson',
        sourceId: lessonId,
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
    expect(recordRes.body.data.sourceType).toBe('class_lesson');
    expect(recordRes.body.data.sourceId).toBe(lessonId);
    expect(recordRes.body.data.matchType).toBe('singles');
    expect(recordRes.body.data.recordedBy).toBe(coach.id);
    expect(recordRes.body.data.result).toBe('A_WIN'); // student1 wins 2-1
    expect(recordRes.body.data.games).toHaveLength(3);
    expect(recordRes.body.data.players.sideA).toHaveLength(1);
    expect(recordRes.body.data.players.sideB).toHaveLength(1);

    const matchRecordId = recordRes.body.data.id;

    // -----------------------------------------------------------------------
    // Step 7: 查看课程战绩列表（match-record 模块 — GET /api/class-lessons/:id/match-records）
    // -----------------------------------------------------------------------
    const listRes = await request(app)
      .get(`/api/class-lessons/${lessonId}/match-records`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].id).toBe(matchRecordId);
    expect(listRes.body.data.items[0].result).toBe('A_WIN');

    // -----------------------------------------------------------------------
    // Step 8: 验证用户个人战绩汇总（match-record 模块 — GET /api/users/:id/match-stats）
    //         跨模块验证: 录入的战绩正确反映在用户统计中
    // -----------------------------------------------------------------------
    const student1Token = signToken(student1.id);
    const student1StatsRes = await request(app)
      .get(`/api/users/${student1.id}/match-stats`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(student1StatsRes.status).toBe(200);
    expect(student1StatsRes.body.data.totalMatches).toBe(1);
    expect(student1StatsRes.body.data.wins).toBe(1);
    expect(student1StatsRes.body.data.losses).toBe(0);

    const student2Token = signToken(student2.id);
    const student2StatsRes = await request(app)
      .get(`/api/users/${student2.id}/match-stats`)
      .set('Authorization', `Bearer ${student2Token}`);

    expect(student2StatsRes.status).toBe(200);
    expect(student2StatsRes.body.data.totalMatches).toBe(1);
    expect(student2StatsRes.body.data.wins).toBe(0);
    expect(student2StatsRes.body.data.losses).toBe(1);
  });
});

// =============================================================================
// 异常流程和补充场景
// =============================================================================

describe('异常流程: 学员班课程战绩录入约束', () => {
  it('课程状态为 scheduled 时不可录入战绩，返回 MATCH_RECORD_LESSON_NOT_STARTED', async () => {
    // 准备数据
    const coach = await createTestUser({ nickname: '教练A', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const student1 = await createTestUser({ nickname: '学员A' });
    const student2 = await createTestUser({ nickname: '学员B' });
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-cl-l2-2' });
    const coachToken = signToken(coach.id);

    // 创建学员班并添加学员
    const classRes = await request(app)
      .post('/api/student-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: '测试班' });
    const classId = classRes.body.data.id;

    await request(app)
      .post(`/api/student-classes/${classId}/members`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student1.id });
    await request(app)
      .post(`/api/student-classes/${classId}/members`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student2.id });

    // 创建课程（状态为 scheduled）
    const lessonRes = await request(app)
      .post(`/api/student-classes/${classId}/lessons`)
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
        sourceType: 'class_lesson',
        sourceId: lessonId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: student1.id }],
          sideB: [{ userId: student2.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(409);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_LESSON_NOT_STARTED');
  });

  it('战绩参与者必须是学员班成员', async () => {
    // 准备数据
    const coach = await createTestUser({ nickname: '教练B', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const student1 = await createTestUser({ nickname: '班内学员' });
    const outsider = await createTestUser({ nickname: '班外用户' });
    const city = await createTestCity({ name: '广州' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-cl-l2-3' });
    const coachToken = signToken(coach.id);

    // 创建学员班，仅添加 student1
    const classRes = await request(app)
      .post('/api/student-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: '限定测试班' });
    const classId = classRes.body.data.id;

    await request(app)
      .post(`/api/student-classes/${classId}/members`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student1.id });

    // 创建课程并设为进行中
    const lessonRes = await request(app)
      .post(`/api/student-classes/${classId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
      });
    const lessonId = lessonRes.body.data.id;

    // 直接将课程设为进行中
    await prisma.classLesson.update({
      where: { id: lessonId },
      data: { startTime: pastDate(2), endTime: futureDate(2), status: 'in_progress' },
    });

    // 尝试录入战绩，其中 outsider 不是班内学员
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        sourceType: 'class_lesson',
        sourceId: lessonId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: student1.id }],
          sideB: [{ userId: outsider.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(403);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_PLAYER_NOT_PARTICIPANT');
  });

  it('训练内容可在课程开始后更新', async () => {
    const coach = await createTestUser({ nickname: '教练C', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const city = await createTestCity({ name: '深圳' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-cl-l2-4' });
    const coachToken = signToken(coach.id);

    // 创建学员班和课程
    const classRes = await request(app)
      .post('/api/student-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: '训练内容测试班' });
    const classId = classRes.body.data.id;

    const lessonRes = await request(app)
      .post(`/api/student-classes/${classId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        trainingContent: '初始训练内容',
      });
    const lessonId = lessonRes.body.data.id;

    // 将课程设为进行中
    await prisma.classLesson.update({
      where: { id: lessonId },
      data: { startTime: pastDate(2), endTime: futureDate(2), status: 'in_progress' },
    });

    // 更新训练内容
    const updateRes = await request(app)
      .put(`/api/student-classes/${classId}/lessons/${lessonId}/training-content`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ trainingContent: '更新后的训练内容：加强步法练习' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.trainingContent).toBe('更新后的训练内容：加强步法练习');
  });

  it('课程笔记可在非取消状态下添加', async () => {
    const coach = await createTestUser({ nickname: '教练D', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const city = await createTestCity({ name: '成都' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-cl-l2-5' });
    const coachToken = signToken(coach.id);

    // 创建学员班和课程
    const classRes = await request(app)
      .post('/api/student-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: '笔记测试班' });
    const classId = classRes.body.data.id;

    const lessonRes = await request(app)
      .post(`/api/student-classes/${classId}/lessons`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
      });
    const lessonId = lessonRes.body.data.id;

    // 在 scheduled 状态下添加笔记
    const noteRes1 = await request(app)
      .post(`/api/student-classes/${classId}/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: '课前准备笔记' });

    expect(noteRes1.status).toBe(201);
    expect(noteRes1.body.data.content).toBe('课前准备笔记');

    // 将课程设为进行中，再添加笔记
    await prisma.classLesson.update({
      where: { id: lessonId },
      data: { startTime: pastDate(2), endTime: futureDate(2), status: 'in_progress' },
    });

    const noteRes2 = await request(app)
      .post(`/api/student-classes/${classId}/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: '课中观察笔记' });

    expect(noteRes2.status).toBe(201);
    expect(noteRes2.body.data.content).toBe('课中观察笔记');

    // 查看笔记列表
    const notesRes = await request(app)
      .get(`/api/student-classes/${classId}/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(notesRes.status).toBe(200);
    expect(notesRes.body.data.items).toHaveLength(2);
  });

  it('教练可为学员添加笔记和标签', async () => {
    const coach = await createTestUser({ nickname: '教练E', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    await prisma.coachApplication.create({
      data: { userId: coach.id, certificateUrls: ['cert.jpg'], status: 'approved' },
    });
    const student = await createTestUser({ nickname: '被标注学员' });
    const coachToken = signToken(coach.id);

    // 创建学员班并添加学员
    const classRes = await request(app)
      .post('/api/student-classes')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: '标签笔记测试班' });
    const classId = classRes.body.data.id;

    await request(app)
      .post(`/api/student-classes/${classId}/members`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ studentId: student.id });

    // 教练为学员添加笔记
    const noteRes = await request(app)
      .post(`/api/student-classes/${classId}/members/${student.id}/notes`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: '步法有明显进步，需要加强高远球' });

    expect(noteRes.status).toBe(201);
    expect(noteRes.body.data.content).toBe('步法有明显进步，需要加强高远球');

    // 教练为学员设置标签
    const tagsRes = await request(app)
      .put(`/api/student-classes/${classId}/members/${student.id}/tags`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ tags: ['左手', '进攻型', '需加强步法'] });

    expect(tagsRes.status).toBe(200);
    expect(tagsRes.body.data.tags).toEqual(['左手', '进攻型', '需加强步法']);

    // 查看学员标签
    const getTagsRes = await request(app)
      .get(`/api/student-classes/${classId}/members/${student.id}/tags`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(getTagsRes.status).toBe(200);
    expect(getTagsRes.body.data.tags).toHaveLength(3);
    expect(getTagsRes.body.data.tags).toContain('左手');

    // 查看学员笔记
    const getNotesRes = await request(app)
      .get(`/api/student-classes/${classId}/members/${student.id}/notes`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(getNotesRes.status).toBe(200);
    expect(getNotesRes.body.data.items).toHaveLength(1);
    expect(getNotesRes.body.data.items[0].content).toBe('步法有明显进步，需要加强高远球');
  });
});
