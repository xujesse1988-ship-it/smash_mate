import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';
import { resolveUrl, handleResponse, getAuthHeaders } from '../utils/api-client';

interface CurrentUser {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
  createdAt: string;
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await fetch(resolveUrl('/api/users/me'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleResponse<CurrentUser>(response);
}

export function useCurrentUser() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
    enabled: isLoggedIn,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
