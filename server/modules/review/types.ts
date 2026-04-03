export type CourseType = 'group-class' | 'private-lesson';

export interface CreateReviewInput {
  coachId: string;
  courseType: CourseType;
  courseId: string;
  rating: number;
  comment?: string;
}

export interface ReviewListQuery {
  page?: number;
  pageSize?: number;
}

export interface CoachRating {
  coachId: string;
  averageRating: number | null;
  totalCount: number;
}
