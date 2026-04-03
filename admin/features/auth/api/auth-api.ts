export async function sendCode(_phone: string): Promise<{ message: string }> {
  throw new Error('Not implemented');
}

export async function login(
  _phone: string,
  _code: string,
): Promise<{
  token: string;
  user: {
    id: string;
    phone: string;
    nickname: string;
    isCoach: boolean;
  };
}> {
  throw new Error('Not implemented');
}
