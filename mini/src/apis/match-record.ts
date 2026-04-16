import { request } from './client'

export type MatchType = 'singles' | 'doubles'
export type SourceType = 'activity' | 'group-class' | 'private-lesson'

export interface PlayerInput {
  userId?: string
  guestName?: string
}

export interface GameInput {
  scoreA: number
  scoreB: number
}

export interface CreateMatchRecordInput {
  sourceType: SourceType
  sourceId: string
  matchType: MatchType
  players: {
    sideA: PlayerInput[]
    sideB: PlayerInput[]
  }
  games: GameInput[]
}

export function createMatchRecord(data: CreateMatchRecordInput): Promise<{ id: string }> {
  return request<{ id: string }>({
    url: '/match-records',
    method: 'POST',
    data: data as unknown as Record<string, unknown>,
  })
}
