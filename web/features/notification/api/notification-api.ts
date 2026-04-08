// TODO: resolveUrl, handleResponse, getAuthHeaders 与其他 api 文件重复，
// 待统一迁移到共享 API Client（shared/api/client.ts）
interface ApiError {
  code: string;
  message: string;
}

function resolveUrl(path: string): string {
  if (typeof globalThis.location !== 'undefined') {
    return path;
  }
  return `http://localhost${path}`;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    const error = body.error as ApiError;
    const err = new Error(error.message) as Error & { code: string };
    err.code = error.code;
    throw err;
  }

  return body.data as T;
}

function getAuthHeaders(): Record<string, string> {
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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
