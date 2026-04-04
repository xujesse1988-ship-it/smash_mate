import { AppError } from '../../infra/error-handler.js';
import { createModuleLogger } from '../../infra/logger.js';
import { registerTask } from '../../infra/scheduler.js';
import { NotificationRepository } from './repository.js';
import type { CreateNotificationInput, NotificationListQuery, NotificationType, TargetType } from './types.js';

const logger = createModuleLogger('notification');

const VALID_NOTIFICATION_TYPES: NotificationType[] = [
  'ACTIVITY_JOINED',
  'ACTIVITY_LEFT',
  'ACTIVITY_UPDATED',
  'ACTIVITY_CANCELLED',
  'GROUP_CLASS_ENROLLED',
  'GROUP_CLASS_ENROLLMENT_CANCELLED',
  'GROUP_CLASS_UPDATED',
  'GROUP_CLASS_CANCELLED',
  'PRIVATE_LESSON_BOOKED',
  'PRIVATE_LESSON_CANCELLED_BY_STUDENT',
  'PRIVATE_LESSON_CANCELLED_BY_COACH',
  'REVIEW_RECEIVED',
];

const VALID_TARGET_TYPES: TargetType[] = [
  'activity',
  'group-class',
  'private-lesson',
  'coach-profile',
];

export class NotificationService {
  private repo: NotificationRepository;

  constructor(repo: NotificationRepository) {
    this.repo = repo;
  }

  async getNotifications(userId: string, query: NotificationListQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const isRead = query.isRead;

    const result = await this.repo.findByUser(userId, {
      page,
      pageSize,
      ...(isRead !== undefined ? { isRead } : {}),
    });

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
    };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.repo.countUnread(userId);
    return { count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.repo.findById(notificationId);

    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', '通知不存在');
    }

    if (notification.userId !== userId) {
      throw new AppError(403, 'NOTIFICATION_FORBIDDEN', '无权操作该通知');
    }

    // Idempotent: already read, return current state
    if (notification.isRead) {
      return notification;
    }

    return this.repo.markAsRead(notificationId);
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const updatedCount = await this.repo.markAllAsRead(userId);
    return { updatedCount };
  }

  // --- Cross-module service methods ---

  async create(input: CreateNotificationInput) {
    // 1. Validate required fields
    if (!input.userId || !input.title || !input.content || !input.targetId) {
      throw new AppError(400, 'NOTIFICATION_INVALID_PARAMS', '通知参数不完整');
    }

    // 2. Validate notification type
    if (!VALID_NOTIFICATION_TYPES.includes(input.type)) {
      throw new AppError(400, 'NOTIFICATION_INVALID_TYPE', '无效的通知类型');
    }

    // 3. Validate target type
    if (!VALID_TARGET_TYPES.includes(input.targetType)) {
      throw new AppError(400, 'NOTIFICATION_INVALID_TARGET_TYPE', '无效的跳转目标类型');
    }

    const notification = await this.repo.create(input);

    logger.info(
      {
        userId: input.userId.slice(0, 8),
        type: input.type,
        targetType: input.targetType,
      },
      '通知已创建',
    );

    return notification;
  }

  async createBatch(
    notifications: CreateNotificationInput[],
  ): Promise<{ successCount: number; failedCount: number }> {
    // Validate input is an array
    if (!Array.isArray(notifications)) {
      throw new AppError(400, 'NOTIFICATION_INVALID_PARAMS', '通知参数必须为数组');
    }

    // Empty array: early return
    if (notifications.length === 0) {
      return { successCount: 0, failedCount: 0 };
    }

    // Validate each notification and separate valid/invalid
    const validNotifications: CreateNotificationInput[] = [];
    let failedCount = 0;

    for (const notification of notifications) {
      try {
        if (!notification.userId || !notification.title || !notification.content || !notification.targetId) {
          throw new Error('Missing required fields');
        }
        if (!VALID_NOTIFICATION_TYPES.includes(notification.type)) {
          throw new Error('Invalid notification type');
        }
        if (!VALID_TARGET_TYPES.includes(notification.targetType)) {
          throw new Error('Invalid target type');
        }
        validNotifications.push(notification);
      } catch (error) {
        failedCount++;
        logger.error(
          {
            userId: notification.userId?.slice(0, 8),
            type: notification.type,
            error: (error as Error).message,
          },
          '批量创建通知：单条验证失败',
        );
      }
    }

    // Batch insert valid notifications
    if (validNotifications.length > 0) {
      const result = await this.repo.createMany(validNotifications);
      const successCount = result.count;

      logger.info(
        { successCount, failedCount },
        '批量创建通知完成',
      );

      return { successCount, failedCount };
    }

    return { successCount: 0, failedCount };
  }

  // --- Scheduled task methods ---

  async cleanExpiredNotifications(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deletedCount = await this.repo.deleteExpired(cutoffDate);

      logger.info(
        { module: 'notification-cleanup', deletedCount },
        `过期通知清理完成，共清理 ${deletedCount} 条`,
      );
    } catch (error) {
      logger.error(
        { module: 'notification-cleanup', error: (error as Error).message },
        '过期通知清理失败',
      );
    }
  }

  /**
   * Register cron tasks for notification cleanup.
   * Design doc §6.3: daily cleanup of expired notifications (90 days old).
   */
  registerScheduledTasks(): void {
    // Every day at 03:00 — clean up notifications older than 90 days
    registerTask('notification-cleanup', '0 3 * * *', async () => {
      await this.cleanExpiredNotifications();
    });
  }
}
