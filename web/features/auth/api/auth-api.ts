// TODO: Migrate to shared API Client (web/shared/utils/api-client.ts) when it is created.
// The shared client should provide:
// - Request interceptor: auto-attach Authorization header from authStore
// - Response interceptor: 401 clears authStore and redirects to /login
// - Unified error extraction (error.code + error.message)
// Auth endpoints don't need the Authorization header, but the 401 interceptor
// should still apply. See web-app.md §6 "API Client 配置".

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
