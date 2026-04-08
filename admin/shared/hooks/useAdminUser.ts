import { useQuery } from '@tanstack/react-query';
import {
  resolveUrl,
  getAdminAuthHeaders,
  handleResponse,
} from '../utils/api-client';
import { useAdminAuthStore } from '../../stores/auth-store';

interface AdminUser {
  id: string;
  phone: string;
  nickname: string;
}

async function fetchAdminUser(): Promise<AdminUser> {
  const response = await fetch(resolveUrl('/api/users/me'), {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });

  return handleResponse<AdminUser>(response);
}

export function useAdminUser() {
  const isLoggedIn = useAdminAuthStore((state) => state.isLoggedIn);

  return useQuery({
    queryKey: ['admin', 'currentUser'],
    queryFn: fetchAdminUser,
    enabled: isLoggedIn,
  });
}
