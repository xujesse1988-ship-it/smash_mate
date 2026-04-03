export async function getNotifications(_params: {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}) {
  throw new Error('Not implemented');
}

export async function getUnreadCount(): Promise<{ count: number }> {
  throw new Error('Not implemented');
}

export async function markAsRead(_id: string) {
  throw new Error('Not implemented');
}

export async function markAllAsRead(): Promise<{ updatedCount: number }> {
  throw new Error('Not implemented');
}
