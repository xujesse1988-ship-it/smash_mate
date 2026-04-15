/**
 * L2 集成测试: CoachStudent 手动添加路径
 *
 * 关键路径（设计文档 §4.1）：
 *   - 教练手动添加已注册学员 F → CoachStudent 入库 source='manual'
 *   - 通过手机号搜索一个未注册的号码 → 抛 404 COACH_STUDENT_NOT_REGISTERED
 *   - 已存在的学员再次 POST /api/coach-students → 幂等，source 保留首次（决策 4）
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

describe('CoachStudent 手动添加路径', () => {
  it('教练手动添加已注册学员 → CoachStudent 入库 source=manual', async () => {
    const coach = await createTestUser({ nickname: '手动添加教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const studentF = await createTestUser({ nickname: '学员F' });

    const service = buildCoachingService();
    const cs = await service.addCoachStudent(coach.id, { studentId: studentF.id });

    expect(cs.source).toBe('manual');
    expect(cs.coachId).toBe(coach.id);
    expect(cs.studentId).toBe(studentF.id);

    const persisted = await prisma.coachStudent.findUnique({
      where: { coachId_studentId: { coachId: coach.id, studentId: studentF.id } },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.source).toBe('manual');
  });

  it('searchStudentByPhone: 未注册号码 → 404 COACH_STUDENT_NOT_REGISTERED', async () => {
    const coach = await createTestUser({ nickname: '搜索教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });

    const service = buildCoachingService();

    await expect(
      service.searchStudentByPhone(coach.id, { phone: '13900000999' }),
    ).rejects.toMatchObject({ code: 'COACH_STUDENT_NOT_REGISTERED', statusCode: 404 });
  });

  it('searchStudentByPhone: 已注册号码 → 返回 userId / nickname / phoneLast4', async () => {
    const coach = await createTestUser({ nickname: '搜索教练2', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const target = await createTestUser({ nickname: '目标学员', phone: '13800007777' });

    const service = buildCoachingService();
    const result = await service.searchStudentByPhone(coach.id, { phone: '13800007777' });

    expect(result).toEqual({
      userId: target.id,
      nickname: '目标学员',
      phoneLast4: '7777',
    });
  });

  it('幂等: 已存在的 CoachStudent 再次 addCoachStudent 不报错且不修改 source', async () => {
    const coach = await createTestUser({ nickname: '幂等教练', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '幂等学员' });

    // Pre-seed with a different source (e.g. 'group-class' from earlier flow)
    await prisma.coachStudent.create({
      data: {
        coachId: coach.id,
        studentId: student.id,
        source: 'group-class',
      },
    });

    const service = buildCoachingService();
    const result = await service.addCoachStudent(coach.id, { studentId: student.id });

    expect(result.source).toBe('group-class'); // not overwritten

    const all = await prisma.coachStudent.findMany({
      where: { coachId: coach.id, studentId: student.id },
    });
    expect(all).toHaveLength(1);
    expect(all[0].source).toBe('group-class');
  });
});
