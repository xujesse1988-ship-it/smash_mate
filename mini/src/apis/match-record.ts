import { request } from './client'
import type { PaginatedResult } from './types'

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

export interface MatchRecordPlayer {
  userId?: string
  guestId?: string
  nickname: string
  avatarUrl?: string | null
}

export interface MatchRecordItem {
  id: string
  sourceType: SourceType
  sourceId: string
  matchType: MatchType
  players: {
    sideA: MatchRecordPlayer[]
    sideB: MatchRecordPlayer[]
  }
  games: { gameNumber: number; scoreA: number; scoreB: number }[]
  result: string
  userResult?: 'WIN' | 'LOSE' | 'DRAW'
  recordedBy: string
  recorder: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  createdAt: string
}

export function createMatchRecord(data: CreateMatchRecordInput): Promise<{ id: string }> {
  return request<{ id: string }>({
    url: '/match-records',
    method: 'POST',
    data: data as unknown as Record<string, unknown>,
  })
}

/** 获取用户战绩列表 */
export function getUserMatchRecords(
  userId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<MatchRecordItem>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
  const query = searchParams.toString()
  return request<PaginatedResult<MatchRecordItem>>({
    url: `/users/${userId}/match-records${query ? `?${query}` : ''}`,
  })
}

/** 删除战绩记录 */
export function deleteMatchRecord(id: string): Promise<void> {
  return request<void>({ url: `/match-records/${id}`, method: 'DELETE' })
}
