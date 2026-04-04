import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a notification in the database for testing.
 * Requires a valid userId (create a user first).
 * Returns the created notification record.
 */
export async function createTestNotification(
  overrides: Partial<{
    userId: string;
    type: string;
    title: string;
    content: string;
    targetType: string;
    targetId: string;
    isRead: boolean;
    createdAt: Date;
  }> = {},
) {
  if (!overrides.userId) {
    throw new Error('createTestNotification requires userId');
  }

  const defaults = {
    type: 'ACTIVITY_JOINED',
    title: '新成员加入',
    content: '张三 加入了你的活动「朝阳体育中心 04/05」',
    targetType: 'activity',
    targetId: `activity-${String(Math.floor(100000 + Math.random() * 900000))}`,
    isRead: false,
  };

  return prisma.notification.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create multiple notifications in the database for testing.
 * Useful for testing pagination and list queries.
 * Returns the array of created notification records.
 */
export async function createTestNotifications(
  userId: string,
  count: number,
  overrides: Partial<{
    type: string;
    title: string;
    content: string;
    targetType: string;
    targetId: string;
    isRead: boolean;
  }> = {},
) {
  const notifications = [];
  for (let i = 0; i < count; i++) {
    const notification = await createTestNotification({
      userId,
      title: `通知 ${i + 1}`,
      content: `通知内容 ${i + 1}`,
      ...overrides,
    });
    notifications.push(notification);
  }
  return notifications;
}

/**
 * Clean up all notification test data.
 * Call this in afterEach/afterAll to ensure test isolation.
 */
export async function cleanupNotificationTestData() {
  await prisma.notification.deleteMany();
}

/**
 * Get the test Prisma client instance (for direct queries in assertions).
 */
export function getTestPrisma() {
  return prisma;
}
