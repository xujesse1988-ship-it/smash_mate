/**
 * L2 集成测试: 团课 → CoachStudent 自动入库
 *
 * 关键路径（设计文档 §9 + §5 scheduler 调整）：
 *   - 教练发布团课 → 学员 A、B 报名
 *   - 模拟时间流逝：直接调用 processStatusTransitions 触发 open → in_progress
 *   - 校验：CoachStudent 表里出现 (coach, A) 与 (coach, B)，source='group-class'
 *   - 重复调用 processStatusTransitions 不会改变 source / 不会重复入库（幂等）
 *   - 退课/取消后**不删** CoachStudent（决策 4：只记首次成为学员的来源）
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
import {
  createTestCoachProfile,
  createTestGroupClass,
  addTestEnrollment,
  getTestPrisma,
} from '@tests/fixtures/coaching.js';
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

describe('关键路径: 团课开始 → CoachStudent 自动入库（source=group-class）', () => {
  it('两名学员报名 + scheduler 流转 → CoachStudent 双行入库；重复触发幂等', async () => {
    const coach = await createTestUser({ nickname: '团课教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const studentA = await createTestUser({ nickname: '学员A' });
    const studentB = await createTestUser({ nickname: '学员B' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: 'GC场地',
      mapPoiId: 'gc-cs-1',
    });

    // Class start time set in the past so that the scheduler will transition
    // it to in_progress on the first call.
    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      title: 'L2团课入库测试',
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      status: 'open',
    });

    await addTestEnrollment(groupClass.id, studentA.id);
    await addTestEnrollment(groupClass.id, studentB.id);

    const coachingService = buildCoachingService();

    // First scheduler tick: should mark the class in_progress and insert
    // both students into CoachStudent with source='group-class'.
    await coachingService.processStatusTransitions();

    const gcAfter1 = await prisma.groupClass.findUnique({ where: { id: groupClass.id } });
    expect(gcAfter1!.status).toBe('in_progress');

    const csAfter1 = await prisma.coachStudent.findMany({
      where: { coachId: coach.id },
      orderBy: { studentId: 'asc' },
    });
    expect(csAfter1).toHaveLength(2);
    for (const row of csAfter1) {
      expect(row.source).toBe('group-class');
      expect([studentA.id, studentB.id]).toContain(row.studentId);
    }

    // Second tick: should be idempotent (no duplicate rows, no source change).
    const firstMetByStudent = new Map(csAfter1.map((r) => [r.studentId, r.firstMetAt]));
    await coachingService.processStatusTransitions();

    const csAfter2 = await prisma.coachStudent.findMany({ where: { coachId: coach.id } });
    expect(csAfter2).toHaveLength(2);
    for (const row of csAfter2) {
      expect(row.source).toBe('group-class');
      expect(row.firstMetAt.getTime()).toBe(firstMetByStudent.get(row.studentId)!.getTime());
    }
  });

  it('学员退课后 CoachStudent 不删除（决策 4：仅记首次来源）', async () => {
    const coach = await createTestUser({ nickname: '团课教练2', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学员C' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: 'GC场地2',
      mapPoiId: 'gc-cs-2',
    });

    const groupClass = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      status: 'open',
    });
    await addTestEnrollment(groupClass.id, student.id);

    const coachingService = buildCoachingService();
    await coachingService.processStatusTransitions();

    const before = await prisma.coachStudent.findMany({
      where: { coachId: coach.id, studentId: student.id },
    });
    expect(before).toHaveLength(1);

    // Manually remove the enrollment (simulating cancelEnrollment outcome)
    await prisma.groupClassEnrollment.deleteMany({
      where: { groupClassId: groupClass.id, userId: student.id },
    });

    const after = await prisma.coachStudent.findMany({
      where: { coachId: coach.id, studentId: student.id },
    });
    expect(after).toHaveLength(1);
    expect(after[0].source).toBe('group-class');
  });
});
