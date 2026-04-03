import type { CreateNotificationInput, NotificationListQuery } from './types.js';

export class NotificationService {
  async getNotifications(_userId: string, _query: NotificationListQuery) {
    throw new Error('Not implemented');
  }

  async getUnreadCount(_userId: string): Promise<{ count: number }> {
    throw new Error('Not implemented');
  }

  async markAsRead(_notificationId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async markAllAsRead(_userId: string): Promise<{ updatedCount: number }> {
    throw new Error('Not implemented');
  }

  // --- Cross-module service methods ---

  async create(_input: CreateNotificationInput) {
    throw new Error('Not implemented');
  }

  async createBatch(
    _notifications: CreateNotificationInput[],
  ): Promise<{ successCount: number; failedCount: number }> {
    throw new Error('Not implemented');
  }
}
