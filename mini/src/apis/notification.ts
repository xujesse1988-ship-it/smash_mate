import { request } from './client'
import type { PaginatedResult } from './types'

export type NotificationType =
  | 'ACTIVITY_JOINED'
  | 'ACTIVITY_LEFT'
  | 'ACTIVITY_UPDATED'
  | 'ACTIVITY_CANCELLED'
  | 'GROUP_CLASS_ENROLLED'
  | 'GROUP_CLASS_ENROLLMENT_CANCELLED'
  | 'GROUP_CLASS_UPDATED'
  | 'GROUP_CLASS_CANCELLED'
  | 'PRIVATE_LESSON_BOOKED'
  | 'PRIVATE_LESSON_CANCELLED_BY_STUDENT'
  | 'PRIVATE_LESSON_CANCELLED_BY_COACH'
  | 'REVIEW_RECEIVED'

export type TargetType = 'activity' | 'group-class' | 'private-lesson' | 'coach-profile'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  content: string
  targetType: TargetType
  targetId: string
  isRead: boolean
  createdAt: string
}

/** 获取通知列表 */
export async function getNotifications(params: {
  page?: number
  pageSize?: number
  isRead?: boolean
}): Promise<PaginatedResult<NotificationItem>> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.isRead !== undefined) searchParams.set('isRead', String(params.isRead))
  const query = searchParams.toString()
  return request<PaginatedResult<NotificationItem>>({
    url: `/notifications${query ? `?${query}` : ''}`,
  })
}

/** 获取未读数 */
export function getUnreadCount(): Promise<{ count: number }> {
  return request<{ count: number }>({ url: '/notifications/unread-count' })
}

/** 标记单条已读 */
export function markAsRead(id: string): Promise<void> {
  return request<void>({ url: `/notifications/${id}/read`, method: 'PUT' })
}

/** 全部已读 */
export function markAllAsRead(): Promise<void> {
  return request<void>({ url: '/notifications/read-all', method: 'PUT' })
}
