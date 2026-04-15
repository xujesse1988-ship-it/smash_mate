/**
 * L2 集成测试: 学员班 → CoachStudent 自动入库
 *
 * 关键路径（设计文档 §5）：
 *   - 教练创建学员班
 *   - addStudentToClass(D, E) → CoachStudent 立即入库 source='class-lesson'
 *     （在成员加入时即刻写入，scheduler 仅作幂等兜底）
 *   - 创建 ClassLesson
 *   - 模拟流转 in_progress → scheduler 二次写入会被 createMany skipDuplicates 忽略
 *     → source 仍为首次的 'class-lesson'
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

describe('关键路径: 学员班加入 → CoachStudent (source=class-lesson) + scheduler 幂等', () => {
  it('addStudentToClass 即写入 CoachStudent；后续 lesson 流转 in_progress 不修改 source', async () => {
    const coach = await createTestUser({ nickname: '学员班教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const studentD = await createTestUser({ nickname: '学员D' });
    const studentE = await createTestUser({ nickname: '学员E' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: 'CL场地',
      mapPoiId: 'cl-cs-1',
    });

    const coachingService = buildCoachingService();

    // Create class
    const sc = await coachingService.createStudentClass(coach.id, { name: '周三进阶班' });

    // Add students; this should immediately populate CoachStudent (source='class-lesson')
    await coachingService.addStudentToClass(coach.id, sc.id, { studentId: studentD.id });
    await coachingService.addStudentToClass(coach.id, sc.id, { studentId: studentE.id });

    const csAfterAdd = await prisma.coachStudent.findMany({
      where: { coachId: coach.id },
      orderBy: { studentId: 'asc' },
    });
    expect(csAfterAdd).toHaveLength(2);
    for (const row of csAfterAdd) {
      expect(row.source).toBe('class-lesson');
      expect([studentD.id, studentE.id]).toContain(row.studentId);
    }
    const firstMetByStudent = new Map(csAfterAdd.map((r) => [r.studentId, r.firstMetAt]));

    // Schedule a class lesson, then flip its startTime to the past so the
    // scheduler picks it up.
    const lesson = await coachingService.createClassLesson(coach.id, sc.id, {
      venueId: venue.id,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    });

    await prisma.classLesson.update({
      where: { id: lesson.id },
      data: {
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await coachingService.processStatusTransitions();

    const lessonAfter = await prisma.classLesson.findUnique({ where: { id: lesson.id } });
    expect(lessonAfter!.status).toBe('in_progress');

    // CoachStudent should still be 2 rows, source unchanged, firstMetAt unchanged.
    const csAfterScheduler = await prisma.coachStudent.findMany({
      where: { coachId: coach.id },
      orderBy: { studentId: 'asc' },
    });
    expect(csAfterScheduler).toHaveLength(2);
    for (const row of csAfterScheduler) {
      expect(row.source).toBe('class-lesson');
      expect(row.firstMetAt.getTime()).toBe(firstMetByStudent.get(row.studentId)!.getTime());
    }
  });
});
