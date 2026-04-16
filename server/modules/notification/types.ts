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
  | 'COACH_APPLICATION_APPROVED'
  | 'COACH_APPLICATION_REJECTED'
  | 'STUDENT_CLASS_ADDED'
  | 'STUDENT_CLASS_REMOVED'
  | 'CLASS_LESSON_CREATED'
  | 'CLASS_LESSON_UPDATED'
  | 'CLASS_LESSON_CANCELLED'
  | 'PRIVATE_STUDENT_ADDED'
  | 'PRIVATE_STUDENT_REMOVED'
  | 'PRIVATE_LESSON_V2_CREATED'
  | 'PRIVATE_LESSON_V2_UPDATED'
  | 'PRIVATE_LESSON_V2_CANCELLED';

export type TargetType =
  | 'activity'
  | 'group-class'
  | 'private-lesson'
  | 'coach-profile'
  | 'student-class'
  | 'class-lesson'
  | 'private-student'
  | 'private-lesson-v2'
  | 'coach-application';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  targetType: TargetType;
  targetId: string;
  recipientWxOpenId?: string;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}
