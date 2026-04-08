import {
  resolveUrl,
  handleResponse,
  getAuthHeaders,
} from '../../../shared/utils/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  targetType: string;
  targetId: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

export async function getNotifications(params: {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}): Promise<NotificationListResult> {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  if (params.isRead !== undefined) {
    searchParams.set('isRead', String(params.isRead));
  }

  const queryString = searchParams.toString();
  const url = resolveUrl(`/api/notifications${queryString ? `?${queryString}` : ''}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<NotificationListResult>(response);
}

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count
// ---------------------------------------------------------------------------

export async function getUnreadCount(): Promise<{ count: number }> {
  const response = await fetch(resolveUrl('/api/notifications/unread-count'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<{ count: number }>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/notifications/:id/read
// ---------------------------------------------------------------------------

export async function markAsRead(id: string): Promise<NotificationItem> {
  const response = await fetch(resolveUrl(`/api/notifications/${id}/read`), {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  return handleResponse<NotificationItem>(response);
}

// ---------------------------------------------------------------------------
// PUT /api/notifications/read-all
// ---------------------------------------------------------------------------

export async function markAllAsRead(): Promise<{ updatedCount: number }> {
  const response = await fetch(resolveUrl('/api/notifications/read-all'), {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  return handleResponse<{ updatedCount: number }>(response);
}
