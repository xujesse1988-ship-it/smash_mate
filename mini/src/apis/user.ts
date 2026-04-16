import { request, uploadFile } from './client'

export interface UserInfo {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  phone: string // 已掩码
  isCoach: boolean
  createdAt: string
}

export interface MatchStats {
  totalMatches: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export interface UserProfile {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  isCoach: boolean
}

/** 获取当前用户信息 */
export function getMe(): Promise<UserInfo> {
  return request<UserInfo>({ url: '/users/me' })
}

/** 更新个人资料 */
export function updateProfile(data: { nickname?: string; avatarUrl?: string; bio?: string }): Promise<UserInfo> {
  return request<UserInfo>({ url: '/users/me', method: 'PUT', data })
}

/** 获取用户公开资料 */
export function getUserProfile(id: string): Promise<UserProfile> {
  return request<UserProfile>({ url: `/users/${id}` })
}

/** 获取用户战绩统计 */
export function getMatchStats(userId: string): Promise<MatchStats> {
  return request<MatchStats>({ url: `/users/${userId}/match-stats` })
}

/** 上传头像 */
export async function uploadAvatar(filePath: string): Promise<string> {
  const result = await uploadFile({ url: '/upload/avatar', filePath, name: 'avatar' })
  return result.avatarUrl
}
