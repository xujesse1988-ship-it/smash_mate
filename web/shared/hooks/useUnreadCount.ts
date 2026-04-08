import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';

function resolveUrl(path: string): string {
  if (typeof globalThis.location !== 'undefined') {
    return path;
  }
  return `http://localhost${path}`;
}

async function fetchUnreadCount(): Promise<{ count: number }> {
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(resolveUrl('/api/notifications/unread-count'), {
    method: 'GET',
    headers,
  });

  const body = await response.json();

  if (!response.ok) {
    const error = body.error as { code: string; message: string };
    const err = new Error(error.message) as Error & { code: string };
    err.code = error.code;
    throw err;
  }

  return body.data as { count: number };
}

/**
 * Shared hook for fetching unread notification count.
 * Used by TopBar for badge display and by NotificationListPage for "mark all read" button visibility.
 * API call is inlined to avoid shared → feature reverse dependency.
 */
export function useUnreadCount() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery({
    queryKey: ['unread-count'],
    queryFn: fetchUnreadCount,
    enabled: isLoggedIn,
    staleTime: 30 * 1000, // 30 seconds
  });
}
