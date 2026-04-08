import { resolveUrl, handleResponse } from '../../../shared/utils/api-client';

export async function sendCode(phone: string): Promise<{ message: string }> {
  const response = await fetch(resolveUrl('/api/auth/send-code'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  return handleResponse<{ message: string }>(response);
}

export async function login(
  phone: string,
  code: string,
  isCoach?: boolean,
): Promise<{
  token: string;
  user: {
    id: string;
    phone: string;
    nickname: string;
    avatarUrl: string | null;
    bio: string | null;
    isCoach: boolean;
    createdAt: string;
  };
  isNewUser: boolean;
}> {
  const body: Record<string, unknown> = { phone, code };
  if (isCoach !== undefined) {
    body.isCoach = isCoach;
  }

  const response = await fetch(resolveUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return handleResponse(response);
}
