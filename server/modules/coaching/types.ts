export type CoachSpecialty = 'singles' | 'doubles' | 'footwork' | 'fitness' | 'tactics';
export type GroupClassStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';
export type PrivateLessonStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface UpdateCoachProfileInput {
  bio?: string;
  specialties?: CoachSpecialty[];
}

export interface CreateGroupClassInput {
  venueId: string;
  title: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  feeDescription?: string;
}

export interface UpdateGroupClassInput {
  title?: string;
  startTime?: string;
  endTime?: string;
  maxParticipants?: number;
  feeDescription?: string;
}

export interface SetAvailabilityInput {
  startTime: string;
  endTime: string;
  venueIds?: string[];
  feeDescription?: string;
}

export interface BookPrivateLessonInput {
  slotId: string;
  venueId?: string;
}

export interface CoachListQuery {
  page?: number;
  pageSize?: number;
  specialty?: CoachSpecialty;
}

export interface PrivateLessonListQuery {
  page?: number;
  pageSize?: number;
  status?: PrivateLessonStatus;
}

export interface EnrollmentListQuery {
  page?: number;
  pageSize?: number;
}
