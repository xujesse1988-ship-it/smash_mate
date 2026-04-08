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
): Promise<{
  token: string;
  user: {
    id: string;
    phone: string;
    nickname: string;
    isCoach: boolean;
  };
}> {
  const response = await fetch(resolveUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });

  return handleResponse(response);
}
