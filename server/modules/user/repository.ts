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

  async findAllUsers() {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { phone: string; nickname: string; isCoach: boolean }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });

      // Auto-create CoachProfile when registering as coach
      if (data.isCoach) {
        await tx.coachProfile.create({
          data: { userId: user.id, bio: null, specialties: [] },
        });
      }

      return user;
    });
  }

  async findByWxOpenId(wxOpenId: string) {
    return prisma.user.findUnique({ where: { wxOpenId } });
  }

  async update(id: string, data: { nickname?: string; avatarUrl?: string; bio?: string }) {
    return prisma.user.update({ where: { id }, data });
  }

  async updateWxOpenId(id: string, wxOpenId: string) {
    return prisma.user.update({ where: { id }, data: { wxOpenId } });
  }

  async updateCoachRole(id: string, isCoach: boolean) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: { isCoach } });

      // Auto-create CoachProfile when enabling coach role
      if (isCoach) {
        await tx.coachProfile.upsert({
          where: { userId: id },
          update: {},
          create: { userId: id, bio: null, specialties: [] },
        });
      }

      return user;
    });
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

  /**
   * Search users by nickname (fuzzy) or phone (last 4 digits / full match).
   * Returns raw user records; the service layer masks phone before returning.
   */
  async searchUsers(query: string, limit: number = 20) {
    // Determine if the query looks like a phone number (all digits)
    const isDigits = /^\d+$/.test(query);

    if (isDigits && query.length === 11) {
      // Full phone number - exact match
      const user = await prisma.user.findUnique({ where: { phone: query } });
      return user ? [user] : [];
    }

    if (isDigits && query.length === 4) {
      // Last 4 digits of phone
      return prisma.user.findMany({
        where: { phone: { endsWith: query } },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Nickname fuzzy match (or digits that are neither 4 nor 11 chars)
    return prisma.user.findMany({
      where: { nickname: { contains: query } },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}
