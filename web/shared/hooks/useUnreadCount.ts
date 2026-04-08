import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '../../features/notification/api/notification-api';
import { useAuthStore } from '../../stores/auth-store';

/**
 * Shared hook for fetching unread notification count.
 * Used by TopBar for badge display and by NotificationListPage for "mark all read" button visibility.
 */
export function useUnreadCount() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery({
    queryKey: ['unread-count'],
    queryFn: getUnreadCount,
    enabled: isLoggedIn,
    staleTime: 30 * 1000, // 30 seconds
  });
}
