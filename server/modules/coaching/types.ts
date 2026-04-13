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
  venueId?: string;
  startTime?: string;
  endTime?: string;
  maxParticipants?: number;
  feeDescription?: string;
}

export interface SetAvailabilitySlotInput {
  startTime: string;
  endTime: string;
  venueIds?: string[];
  feeDescription?: string;
}

export interface SetAvailabilityInput {
  slots: SetAvailabilitySlotInput[];
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
  type?: string;
  status?: string;
}

// ===== Coaching v2 Types =====

export type CoachApplicationStatus = 'pending' | 'approved' | 'rejected';
export type ClassLessonStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type PrivateLessonV2Status = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

// --- Coach Application (GA) ---

export interface CreateCoachApplicationInput {
  certificateUrls: string[];
  description?: string;
}

export interface ReviewCoachApplicationInput {
  action: 'approve' | 'reject';
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

// --- Private Student (GC) ---

export interface AddPrivateStudentInput {
  studentId: string;
}

export interface CreatePrivateLessonV2Input {
  venueId?: string;
  startTime: string;
  endTime: string;
  trainingContent?: string;
}

export interface UpdatePrivateLessonV2Input {
  venueId?: string;
  startTime?: string;
  endTime?: string;
  trainingContent?: string;
}

export interface PrivateLessonV2ListQuery {
  page?: number;
  pageSize?: number;
  status?: PrivateLessonV2Status;
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
