export { CoachingService } from './service.js';
export { CoachingRepository } from './repository.js';
export { createCoachingController, createCoachingService } from './controller.js';
export type {
  CoachSpecialty,
  GroupClassStatus,
  PrivateLessonStatus,
  UpdateCoachProfileInput,
  CreateGroupClassInput,
  UpdateGroupClassInput,
  SetAvailabilityInput,
  BookPrivateLessonInput,
  CoachListQuery,
  PrivateLessonListQuery,
  EnrollmentListQuery,
  ClassLessonStatus,
  CreateStudentClassInput,
  UpdateStudentClassInput,
  AddStudentToClassInput,
  CreateClassLessonInput,
  UpdateClassLessonInput,
  ClassLessonListQuery,
  CreateLessonNoteInput,
  CreateStudentNoteInput,
  SetStudentTagsInput,
} from './types.js';
