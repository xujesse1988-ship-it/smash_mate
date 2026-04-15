export type CoachSpecialty = 'singles' | 'doubles' | 'footwork' | 'fitness' | 'tactics';
export type GroupClassStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';
export type PrivateLessonStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

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
  venueId?: string;
  startTime?: string;
  endTime?: string;
  maxParticipants?: number;
  feeDescription?: string;
}

/**
 * Unified availability (slot) creation input. In the unified model a slot is a
 * PrivateLesson with studentId=null and source=null.
 */
export interface CreateAvailabilitySlotInput {
  startTime: string;
  endTime: string;
  venueIds?: string[];
  feeDescription?: string;
}

export interface CreateAvailabilityInput {
  slots: CreateAvailabilitySlotInput[];
}

export interface BookPrivateLessonInput {
  /** The PrivateLesson id of the open slot being booked. */
  lessonId?: string;
  /** Backward-compat alias used by the legacy POST /api/private-lessons/book route. */
  slotId?: string;
  venueId?: string;
}

export interface ScheduleLessonForStudentInput {
  startTime: string;
  endTime: string;
  venueId?: string;
  feeDescription?: string;
  trainingContent?: string;
}

export interface UpdatePrivateLessonInput {
  venueId?: string;
  startTime?: string;
  endTime?: string;
  feeDescription?: string;
  trainingContent?: string;
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
  type?: string;
  status?: string;
}

// ===== Coaching v2 Types =====

export type CoachApplicationStatus = 'pending' | 'approved' | 'rejected';
export type ClassLessonStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

// --- Coach Application (GA) ---

export interface CreateCoachApplicationInput {
  certificateUrls: string[];
  description?: string;
}

export interface ReviewCoachApplicationInput {
  status: 'approved' | 'rejected';
  rejectReason?: string;
}

export interface CoachApplicationListQuery {
  status?: CoachApplicationStatus;
  page?: number;
  pageSize?: number;
}

// --- Student Class (GB) ---

export interface CreateStudentClassInput {
  name: string;
}

export interface UpdateStudentClassInput {
  name: string;
}

export interface AddStudentToClassInput {
  studentId: string;
}

export interface CreateClassLessonInput {
  venueId?: string;
  startTime: string;
  endTime: string;
  trainingContent?: string;
}

export interface UpdateClassLessonInput {
  venueId?: string;
  startTime?: string;
  endTime?: string;
  trainingContent?: string;
}

export interface ClassLessonListQuery {
  page?: number;
  pageSize?: number;
  status?: ClassLessonStatus;
}

// --- Coach Student (GC unified) ---

export interface AddCoachStudentInput {
  studentId: string;
}

export interface SearchStudentByPhoneInput {
  phone: string;
}

export interface SetCoachStudentTagsInput {
  tags: string[];
}

export interface CoachStudentFilters {
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CoachStudentItem {
  studentId: string;
  nickname: string;
  avatarUrl: string | null;
  phoneLast4: string | null;
  firstMetAt: Date;
  source: string;
  tags: string[];
  studentClasses: Array<{ id: string; name: string }>;
}

export interface PrivateLessonItem {
  id: string;
  coachId: string;
  studentId: string | null;
  venueId: string | null;
  venueIds: string[];
  startTime: Date;
  endTime: Date;
  feeDescription: string | null;
  trainingContent: string | null;
  source: string | null;
  status: PrivateLessonStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachStudentDetail extends CoachStudentItem {
  recentLessons: Array<{
    type: 'group-class' | 'private-lesson' | 'class-lesson';
    id: string;
    title: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
  }>;
}

// --- Notes & Tags (shared) ---

export interface CreateLessonNoteInput {
  content: string;
}

export interface CreateStudentNoteInput {
  content: string;
}

export interface SetStudentTagsInput {
  tags: string[];
}
