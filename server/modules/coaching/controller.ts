import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../infra/auth.js';
import { adminAuthMiddleware } from '../../infra/admin-auth.js';
import { success, created } from '../../infra/response.js';
import { CoachingService } from './service.js';
import { CoachingRepository } from './repository.js';
import { VenueService } from '../venue/service.js';
import { VenueRepository } from '../venue/repository.js';
import { UserService } from '../user/service.js';
import { UserRepository } from '../user/repository.js';
import { NotificationService } from '../notification/service.js';
import { NotificationRepository } from '../notification/repository.js';

export function createCoachingController(): Router {
  const router = Router();

  // Wire up dependencies
  const coachingRepo = new CoachingRepository();
  const venueService = new VenueService(new VenueRepository());
  const userService = new UserService(new UserRepository());
  const notificationService = new NotificationService(new NotificationRepository());
  const service = new CoachingService(coachingRepo, userService, venueService, notificationService);

  // Register scheduled tasks
  service.registerScheduledTasks();

  // GET /api/coaches
  router.get(
    '/coaches',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          specialty: req.query.specialty as string | undefined,
        };
        const result = await service.getCoachList(query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/coaches/me — must be before GET /api/coaches/:id to avoid conflict
  router.put(
    '/coaches/me',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateCoachProfile(userId, req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/coaches/:id
  router.get(
    '/coaches/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getCoachProfile(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/group-classes
  router.post(
    '/group-classes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createGroupClass(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/group-classes/:id
  router.get(
    '/group-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getGroupClassDetail(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/group-classes/:id
  router.put(
    '/group-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateGroupClass(req.params.id, userId, req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/group-classes/:id/cancel
  router.post(
    '/group-classes/:id/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelGroupClass(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/group-classes/:id/enroll
  router.post(
    '/group-classes/:id/enroll',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.enrollGroupClass(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/group-classes/:id/cancel-enrollment
  router.post(
    '/group-classes/:id/cancel-enrollment',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelEnrollment(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/private-lessons/availability
  router.post(
    '/private-lessons/availability',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.setAvailability(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/coaches/:id/availability
  router.get(
    '/coaches/:id/availability',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const options: { startDate?: string; endDate?: string } = {};
        if (req.query.startDate) options.startDate = req.query.startDate as string;
        if (req.query.endDate) options.endDate = req.query.endDate as string;
        const result = await service.getCoachAvailability(req.params.id, options);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/private-lessons/book
  router.post(
    '/private-lessons/book',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.bookPrivateLesson(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/private-lessons/:id/cancel
  router.post(
    '/private-lessons/:id/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelPrivateLesson(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/users/:id/enrollments
  router.get(
    '/users/:id/enrollments',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          type: req.query.type as string | undefined,
          status: req.query.status as string | undefined,
        };
        const result = await service.getUserEnrollments(req.params.id, query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/coaches/:id/private-lessons
  router.get(
    '/coaches/:id/private-lessons',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          status: req.query.status as string | undefined,
        };
        const result = await service.getCoachPrivateLessons(req.params.id, query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Coach Application Routes (GA)
  // =========================================================================

  // POST /api/coach-applications
  router.post(
    '/coach-applications',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.submitCoachApplication(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/coach-applications/me
  router.get(
    '/coach-applications/me',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getMyApplicationStatus(userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Admin Coach Application Routes (GA)
  // =========================================================================

  // GET /api/admin/coach-applications
  router.get(
    '/admin/coach-applications',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          status: req.query.status as string | undefined,
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
        };
        const result = await service.getApplicationList(query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/admin/coach-applications/:id
  router.get(
    '/admin/coach-applications/:id',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getApplicationById(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/admin/coach-applications/:id/review
  router.post(
    '/admin/coach-applications/:id/review',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const adminId = (req as AuthRequest).userId!;
        const result = await service.reviewCoachApplication(
          req.params.id,
          adminId,
          req.body,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Private Student Routes (GC)
  // =========================================================================

  // POST /api/private-students — Add private student
  router.post(
    '/private-students',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addPrivateStudent(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/private-students — List private students
  router.get(
    '/private-students',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const includeInactive = req.query.includeInactive === 'true';
        const result = await service.getPrivateStudents(userId, includeInactive);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/private-students/:id — Private student detail
  router.get(
    '/private-students/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getPrivateStudentDetail(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/private-students/:id — Remove private student (soft delete)
  router.delete(
    '/private-students/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.removePrivateStudent(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/private-students/:id/lessons — Create private lesson v2
  router.post(
    '/private-students/:id/lessons',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createPrivateLessonV2(
          req.params.id,
          userId,
          req.body,
        );
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/private-students/:id/lessons — List private lessons v2
  router.get(
    '/private-students/:id/lessons',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const options = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize:
            req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          status: req.query.status as string | undefined,
        };
        const result = await service.getPrivateLessonsV2(
          req.params.id,
          userId,
          options,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/private-students/:id/lessons/:lessonId — Private lesson v2 detail
  router.get(
    '/private-students/:id/lessons/:lessonId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getPrivateLessonV2Detail(
          req.params.id,
          req.params.lessonId,
          userId,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/private-students/:id/lessons/:lessonId — Update private lesson v2
  router.put(
    '/private-students/:id/lessons/:lessonId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updatePrivateLessonV2(
          req.params.id,
          req.params.lessonId,
          userId,
          req.body,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/private-students/:id/lessons/:lessonId/cancel — Cancel private lesson v2
  router.post(
    '/private-students/:id/lessons/:lessonId/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelPrivateLessonV2(
          req.params.id,
          req.params.lessonId,
          userId,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/private-students/:id/lessons/:lessonId/training-content
  router.put(
    '/private-students/:id/lessons/:lessonId/training-content',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updatePrivateLessonV2TrainingContent(
          req.params.id,
          req.params.lessonId,
          userId,
          req.body,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Private Student Notes & Tags Routes (GC)
  // =========================================================================

  // POST /api/private-students/:id/lessons/:lessonId/notes — Add lesson note
  router.post(
    '/private-students/:id/lessons/:lessonId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addPrivateLessonNote(
          req.params.id,
          req.params.lessonId,
          userId,
          req.body,
        );
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/private-students/:id/lessons/:lessonId/notes — Get lesson notes
  router.get(
    '/private-students/:id/lessons/:lessonId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getPrivateLessonNotes(
          req.params.id,
          req.params.lessonId,
          userId,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/private-students/:id/notes — Add student note
  router.post(
    '/private-students/:id/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addPrivateStudentNote(
          req.params.id,
          userId,
          req.body,
        );
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/private-students/:id/notes — Get student notes
  router.get(
    '/private-students/:id/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getPrivateStudentNotes(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/private-students/:id/tags — Set student tags
  router.put(
    '/private-students/:id/tags',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.setPrivateStudentTags(
          req.params.id,
          userId,
          req.body,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/private-students/:id/tags — Get student tags
  router.get(
    '/private-students/:id/tags',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getPrivateStudentTags(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Student Class Routes (GB)
  // =========================================================================

  // POST /api/student-classes
  router.post(
    '/student-classes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createStudentClass(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/student-classes
  router.get(
    '/student-classes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getStudentClasses(userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/student-classes/:id
  router.get(
    '/student-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getStudentClassDetail(userId, req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/student-classes/:id
  router.put(
    '/student-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateStudentClass(userId, req.params.id, req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/student-classes/:id
  router.delete(
    '/student-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.deleteStudentClass(userId, req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/student-classes/:id/members
  router.post(
    '/student-classes/:id/members',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addStudentToClass(userId, req.params.id, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/student-classes/:id/members/:studentId
  router.delete(
    '/student-classes/:id/members/:studentId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.removeStudentFromClass(userId, req.params.id, req.params.studentId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/student-classes/:id/lessons
  router.post(
    '/student-classes/:id/lessons',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createClassLesson(userId, req.params.id, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/student-classes/:id/lessons
  router.get(
    '/student-classes/:id/lessons',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          status: req.query.status as string | undefined,
        };
        const result = await service.getClassLessons(userId, req.params.id, query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/student-classes/:id/lessons/:lessonId
  router.get(
    '/student-classes/:id/lessons/:lessonId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getClassLessonDetail(userId, req.params.id, req.params.lessonId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/student-classes/:id/lessons/:lessonId
  router.put(
    '/student-classes/:id/lessons/:lessonId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateClassLesson(userId, req.params.id, req.params.lessonId, req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/student-classes/:id/lessons/:lessonId/cancel
  router.post(
    '/student-classes/:id/lessons/:lessonId/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelClassLesson(userId, req.params.id, req.params.lessonId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/student-classes/:id/lessons/:lessonId/training-content
  router.put(
    '/student-classes/:id/lessons/:lessonId/training-content',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateClassLessonTrainingContent(userId, req.params.id, req.params.lessonId, req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/student-classes/:id/lessons/:lessonId/notes
  router.post(
    '/student-classes/:id/lessons/:lessonId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addClassLessonNote(userId, req.params.id, req.params.lessonId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/student-classes/:id/lessons/:lessonId/notes
  router.get(
    '/student-classes/:id/lessons/:lessonId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getClassLessonNotes(userId, req.params.id, req.params.lessonId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/student-classes/:id/members/:studentId/notes
  router.post(
    '/student-classes/:id/members/:studentId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addStudentNote(userId, req.params.id, req.params.studentId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/student-classes/:id/members/:studentId/notes
  router.get(
    '/student-classes/:id/members/:studentId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getStudentNotes(userId, req.params.id, req.params.studentId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/student-classes/:id/members/:studentId/tags
  router.put(
    '/student-classes/:id/members/:studentId/tags',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.setStudentTags(userId, req.params.id, req.params.studentId, req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/student-classes/:id/members/:studentId/tags
  router.get(
    '/student-classes/:id/members/:studentId/tags',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getStudentTags(userId, req.params.id, req.params.studentId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/**
 * Create a CoachingService instance for use by other modules or integration tests.
 * This factory creates the full dependency chain.
 */
export function createCoachingService(): CoachingService {
  const coachingRepo = new CoachingRepository();
  const venueService = new VenueService(new VenueRepository());
  const userService = new UserService(new UserRepository());
  const notificationService = new NotificationService(new NotificationRepository());
  return new CoachingService(coachingRepo, userService, venueService, notificationService);
}
