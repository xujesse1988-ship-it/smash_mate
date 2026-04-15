/**
 * L2 集成测试: 学员班课程 → 战绩录入
 *
 * 关键路径：
 *   - 教练创建学员班，加入两名学员
 *   - 创建 ClassLesson；流转到 in_progress
 *   - 学员之间通过 POST /api/match-records 录入战绩，sourceType='class_lesson'
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
import { createTestCoachProfile, getTestPrisma } from '@tests/fixtures/coaching.js';
import { resetTestDatabase } from '@tests/fixtures/database.js';

const prisma = getTestPrisma();

function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, { expiresIn: '7d' });
}

function buildCoachingService(): CoachingService {
  return new CoachingService(
    new CoachingRepository(),
    new UserService(new UserRepository()),
    new VenueService(new VenueRepository()),
    new NotificationService(new NotificationRepository()),
  );
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

describe('关键路径: 学员班课程 → 战绩 (sourceType=class_lesson)', () => {
  it('班课程 in_progress → 学员录入战绩成功', async () => {
    const coach = await createTestUser({ nickname: '班课教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const studentA = await createTestUser({ nickname: '学员A' });
    const studentB = await createTestUser({ nickname: '学员B' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '班课场地',
      mapPoiId: 'cl-mr-1',
    });

    const studentAToken = signToken(studentA.id);

    const coachingService = buildCoachingService();
    const sc = await coachingService.createStudentClass(coach.id, { name: '战绩测试班' });
    await coachingService.addStudentToClass(coach.id, sc.id, { studentId: studentA.id });
    await coachingService.addStudentToClass(coach.id, sc.id, { studentId: studentB.id });

    // Insert a ClassLesson directly with past start, future end → in_progress
    const lesson = await prisma.classLesson.create({
      data: {
        studentClassId: sc.id,
        coachId: coach.id,
        venueId: venue.id,
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        status: 'scheduled',
      },
    });

    await coachingService.processStatusTransitions();
    const lessonAfter = await prisma.classLesson.findUnique({ where: { id: lesson.id } });
    expect(lessonAfter!.status).toBe('in_progress');

    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        sourceType: 'class_lesson',
        sourceId: lesson.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: studentA.id }],
          sideB: [{ userId: studentB.id }],
        },
        games: [
          { scoreA: 21, scoreB: 15 },
          { scoreA: 21, scoreB: 19 },
        ],
      });

    expect(recordRes.status).toBe(201);
    expect(recordRes.body.data.sourceType).toBe('class_lesson');
    expect(recordRes.body.data.sourceId).toBe(lesson.id);
  });

  it('已取消的班课程拒绝录入战绩 → 409 MATCH_RECORD_LESSON_CANCELLED', async () => {
    const coach = await createTestUser({ nickname: '班课教练2', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const studentA = await createTestUser({ nickname: '学员X' });
    const studentB = await createTestUser({ nickname: '学员Y' });

    const studentAToken = signToken(studentA.id);

    const coachingService = buildCoachingService();
    const sc = await coachingService.createStudentClass(coach.id, { name: '取消测试班' });
    await coachingService.addStudentToClass(coach.id, sc.id, { studentId: studentA.id });
    await coachingService.addStudentToClass(coach.id, sc.id, { studentId: studentB.id });

    const lesson = await prisma.classLesson.create({
      data: {
        studentClassId: sc.id,
        coachId: coach.id,
        venueId: null,
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        status: 'cancelled',
      },
    });

    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        sourceType: 'class_lesson',
        sourceId: lesson.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: studentA.id }],
          sideB: [{ userId: studentB.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(409);
    expect(recordRes.body.error?.code).toBe('MATCH_RECORD_LESSON_CANCELLED');
  });
});
