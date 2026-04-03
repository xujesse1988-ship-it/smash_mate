import { prisma } from '../../infra/database.js';

export class UserRepository {
  async findByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.user.findMany({ where: { id: { in: ids } } });
  }

  async create(data: { phone: string; nickname: string; isCoach: boolean }) {
    return prisma.user.create({ data });
  }

  async update(id: string, data: { nickname?: string; avatarUrl?: string; bio?: string }) {
    return prisma.user.update({ where: { id }, data });
  }

  async updateCoachRole(id: string, isCoach: boolean) {
    return prisma.user.update({ where: { id }, data: { isCoach } });
  }

  async createVerificationCode(data: { phone: string; code: string; expiresAt: Date }) {
    return prisma.verificationCode.create({ data });
  }

  async findLatestVerificationCode(phone: string, unusedOnly: boolean = false) {
    return prisma.verificationCode.findFirst({
      where: {
        phone,
        ...(unusedOnly ? { used: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markVerificationCodeUsed(id: string) {
    await prisma.verificationCode.update({
      where: { id },
      data: { used: true },
    });
  }

  async findOrCreatePhoneLock(phone: string) {
    return prisma.phoneLock.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });
  }

  async updatePhoneLock(id: string, data: { failCount: number; lockedUntil: Date | null }) {
    await prisma.phoneLock.update({
      where: { id },
      data,
    });
  }
}
