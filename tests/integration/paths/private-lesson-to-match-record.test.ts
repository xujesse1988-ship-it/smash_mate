/**
 * L2 集成测试: 统一私教课 → 战绩录入
 *
 * 关键路径：
 *   - 教练为学员安排一次私教课（unified PrivateLesson, source=scheduled）
 *   - 流转 in_progress → completed
 *   - 学员通过 POST /api/match-records 录入战绩，sourceType='private-lesson'
 *   - 校验战绩入库
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

describe('关键路径: 统一私教课 → 战绩 (sourceType=private-lesson)', () => {
  it('教练排课 → 流转 completed → 录入战绩成功', async () => {
    const coach = await createTestUser({ nickname: '私教教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '私教学员' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '私教场地',
      mapPoiId: 'pl-mr-1',
    });

    const studentToken = signToken(student.id);

    // Pre-insert PrivateLesson directly via prisma (avoids the future-time guard
    // since we want to immediately mark it completed).
    const lesson = await prisma.privateLesson.create({
      data: {
        coachId: coach.id,
        studentId: student.id,
        venueId: venue.id,
        startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'scheduled',
        source: 'scheduled',
      },
    });

    // Pre-seed CoachStudent so the service flow sees the student in coach's library.
    await prisma.coachStudent.create({
      data: { coachId: coach.id, studentId: student.id, source: 'private-lesson' },
    });

    // Run scheduler: scheduled (past start) → in_progress → completed (past end)
    const coachingService = buildCoachingService();
    await coachingService.processStatusTransitions();

    const lessonAfter = await prisma.privateLesson.findUnique({ where: { id: lesson.id } });
    expect(lessonAfter!.status).toBe('completed');

    // Submit a match record using the completed private lesson as source.
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        sourceType: 'private-lesson',
        sourceId: lesson.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: student.id }],
          sideB: [{ userId: coach.id }],
        },
        games: [
          { scoreA: 21, scoreB: 15 },
          { scoreA: 21, scoreB: 18 },
        ],
      });

    expect(recordRes.status).toBe(201);
    expect(recordRes.body.data.sourceType).toBe('private-lesson');
    expect(recordRes.body.data.sourceId).toBe(lesson.id);
  });

  it('未结束的私教课不可录入战绩 → 409 MATCH_RECORD_SOURCE_NOT_COMPLETED', async () => {
    const coach = await createTestUser({ nickname: '私教教练2', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '私教学员2' });

    const studentToken = signToken(student.id);

    const lesson = await prisma.privateLesson.create({
      data: {
        coachId: coach.id,
        studentId: student.id,
        venueId: null,
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        status: 'scheduled',
        source: 'scheduled',
      },
    });

    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        sourceType: 'private-lesson',
        sourceId: lesson.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: student.id }],
          sideB: [{ userId: coach.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(409);
    expect(recordRes.body.error?.code).toBe('MATCH_RECORD_SOURCE_NOT_COMPLETED');
  });
});
