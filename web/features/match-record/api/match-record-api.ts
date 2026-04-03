export async function createMatchRecord(_data: {
  sourceType: string;
  sourceId: string;
  matchType: string;
  players: Array<{
    side: string;
    userId?: string;
    guestName?: string;
  }>;
  games: Array<{
    gameNumber: number;
    scoreA: number;
    scoreB: number;
  }>;
}) {
  throw new Error('Not implemented');
}

export async function deleteMatchRecord(_id: string) {
  throw new Error('Not implemented');
}

export async function getSourceMatchRecords(
  _sourceType: string,
  _sourceId: string,
  _params: { page?: number; pageSize?: number },
) {
  throw new Error('Not implemented');
}

export async function getUserMatchRecords(
  _userId: string,
  _params: { page?: number; pageSize?: number },
) {
  throw new Error('Not implemented');
}

export async function getUserMatchStats(_userId: string) {
  throw new Error('Not implemented');
}
