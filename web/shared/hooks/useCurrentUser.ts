import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';

interface CurrentUser {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
  createdAt: string;
}

function resolveUrl(path: string): string {
  if (typeof globalThis.location !== 'undefined') {
    return path;
  }
  return `http://localhost${path}`;
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(resolveUrl('/api/users/me'), {
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

  return body.data as CurrentUser;
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
