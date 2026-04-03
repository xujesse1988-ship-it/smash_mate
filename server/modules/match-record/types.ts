export type SourceType = 'activity' | 'group-class' | 'private-lesson';
export type MatchType = 'singles' | 'doubles';

export interface PlayerInput {
  side: 'A' | 'B';
  userId?: string;
  guestName?: string;
}

export interface GameInput {
  gameNumber: number;
  scoreA: number;
  scoreB: number;
}

export interface CreateMatchRecordInput {
  sourceType: SourceType;
  sourceId: string;
  matchType: MatchType;
  players: PlayerInput[];
  games: GameInput[];
}

export interface MatchRecordListQuery {
  page?: number;
  pageSize?: number;
}

export interface UserMatchRecordQuery {
  page?: number;
  pageSize?: number;
}
