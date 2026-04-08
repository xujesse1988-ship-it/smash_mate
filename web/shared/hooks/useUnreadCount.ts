import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';
import { resolveUrl, handleResponse, getAuthHeaders } from '../utils/api-client';

async function fetchUnreadCount(): Promise<{ count: number }> {
  const response = await fetch(resolveUrl('/api/notifications/unread-count'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<{ count: number }>(response);
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
