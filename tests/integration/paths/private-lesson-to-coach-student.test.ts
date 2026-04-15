/**
 * L2 集成测试: 私教课 → CoachStudent 自动入库
 *
 * 关键路径（设计文档 §5）：
 *   - 教练开放时段（slot：studentId=null, source=null）
 *   - 学员预约 → studentId/source='booked'
 *   - 模拟流转：startTime 设为过去 + processStatusTransitions
 *     → status='in_progress'，CoachStudent 入库 source='private-lesson'
 *   - 教练后续直接 scheduleLessonForStudent 给同一学员排课，再次流转
 *     → CoachStudent 仍保留首次 source='private-lesson'（决策 4）
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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

describe('关键路径: 私教课预约 → 流转 → CoachStudent (source=private-lesson)', () => {
  it('booked 学员 → 流转 in_progress → CoachStudent 入库；后续 scheduled 排课不覆盖 source', async () => {
    const coach = await createTestUser({ nickname: '私教教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const studentC = await createTestUser({ nickname: '学员C' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: 'PL场地',
      mapPoiId: 'pl-cs-1',
    });

    const coachingService = buildCoachingService();

    // Step 1: coach opens an availability slot directly via service
    // (avoiding the 1-hour-future constraint by inserting via prisma).
    const slotStart = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
    const slotEnd = new Date(slotStart.getTime() + 90 * 60 * 1000);
    const slot = await prisma.privateLesson.create({
      data: {
        coachId: coach.id,
        startTime: slotStart,
        endTime: slotEnd,
        venueIds: [venue.id],
        feeDescription: '300元/小时',
        studentId: null,
        source: null,
        status: 'scheduled',
      },
    });

    // Step 2: student books the slot
    const booked = await coachingService.bookLesson(slot.id, studentC.id, venue.id);
    expect(booked.studentId).toBe(studentC.id);
    expect(booked.source).toBe('booked');

    // Step 3: simulate time passing — set startTime to the past, then run scheduler
    await prisma.privateLesson.update({
      where: { id: slot.id },
      data: {
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await coachingService.processStatusTransitions();

    const lessonAfter = await prisma.privateLesson.findUnique({ where: { id: slot.id } });
    expect(lessonAfter!.status).toBe('in_progress');

    const csAfter = await prisma.coachStudent.findUnique({
      where: { coachId_studentId: { coachId: coach.id, studentId: studentC.id } },
    });
    expect(csAfter).not.toBeNull();
    expect(csAfter!.source).toBe('private-lesson');

    // Step 4: coach now directly schedules another lesson for student C.
    const schedFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const schedFutureEnd = new Date(schedFuture.getTime() + 90 * 60 * 1000);
    const scheduled = await coachingService.scheduleLessonForStudent(coach.id, studentC.id, {
      startTime: schedFuture.toISOString(),
      endTime: schedFutureEnd.toISOString(),
    });
    expect(scheduled.source).toBe('scheduled');

    // Step 5: simulate that lesson's start time as past + run scheduler
    await prisma.privateLesson.update({
      where: { id: scheduled.id },
      data: {
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await coachingService.processStatusTransitions();

    // CoachStudent row must still carry the FIRST source ('private-lesson'),
    // not be overwritten to 'scheduled'.
    const csFinal = await prisma.coachStudent.findUnique({
      where: { coachId_studentId: { coachId: coach.id, studentId: studentC.id } },
    });
    expect(csFinal).not.toBeNull();
    expect(csFinal!.source).toBe('private-lesson');
  });
});
