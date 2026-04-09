import { resolveUrl, handleResponse } from '../../../shared/utils/api-client';

export interface User {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
  createdAt: string;
}

export async function getAllUsers(): Promise<User[]> {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    throw new Error('No token found');
  }

  const response = await fetch(resolveUrl('/api/admin/users'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<User[]>(response);
}
