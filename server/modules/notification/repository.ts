import { prisma } from '../../infra/database.js';
import type { CreateNotificationInput, NotificationListQuery } from './types.js';

export class NotificationRepository {
  async create(data: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        content: data.content,
        targetType: data.targetType,
        targetId: data.targetId,
        isRead: false,
      },
    });
  }

  async createMany(data: CreateNotificationInput[]) {
    return prisma.notification.createMany({
      data: data.map((item) => ({
        userId: item.userId,
        type: item.type,
        title: item.title,
        content: item.content,
        targetType: item.targetType,
        targetId: item.targetId,
        isRead: false,
      })),
    });
  }

  async findByUser(
    userId: string,
    query: Required<Pick<NotificationListQuery, 'page' | 'pageSize'>> & { isRead?: boolean },
  ) {
    const where: { userId: string; isRead?: boolean } = { userId };
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    return { items, total };
  }

  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  }

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  }

  async deleteExpired(cutoffDate: Date): Promise<number> {
    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }
}
