export type SourceType = 'activity' | 'group-class' | 'private-lesson';
export type MatchType = 'singles' | 'doubles';
export type MatchResult = 'A_WIN' | 'B_WIN' | 'DRAW';
export type UserResult = 'WIN' | 'LOSE' | 'DRAW';

export interface PlayerInput {
  userId?: string;
  guestName?: string;
}

export interface PlayersInput {
  sideA: PlayerInput[];
  sideB: PlayerInput[];
}

export interface GameInput {
  scoreA: number;
  scoreB: number;
}

export interface CreateMatchRecordInput {
  sourceType: SourceType;
  sourceId: string;
  matchType: MatchType;
  players: PlayersInput;
  games: GameInput[];
}

export interface MatchRecordListQuery {
  page?: number;
  pageSize?: number;
}

export interface UserMatchRecordQuery {
  page?: number;
  pageSize?: number;
  sourceType?: SourceType;
}
