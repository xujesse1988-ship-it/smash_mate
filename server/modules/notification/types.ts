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
  | 'REVIEW_RECEIVED';

export type TargetType = 'activity' | 'group-class' | 'private-lesson' | 'coach-profile';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  targetType: TargetType;
  targetId: string;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}
