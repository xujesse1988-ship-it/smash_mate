export async function sendCode(_phone: string): Promise<{ message: string }> {
  throw new Error('Not implemented');
}

export async function login(
  _phone: string,
  _code: string,
  _isCoach?: boolean,
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
  throw new Error('Not implemented');
}
