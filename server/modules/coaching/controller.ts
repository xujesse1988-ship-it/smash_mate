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

/**
 * HTTP 501 responder for legacy private-student routes that were removed in the
 * unified coach-student refactor. Sub-task 3 will introduce new
 * /api/coach-students/* replacements. Until then we keep these routes present
 * to avoid 404s on callers, but signal clearly that they moved.
 */
function notImplemented(newEndpoint: string) {
  return (_req: Request, res: Response) => {
    res.status(501).json({
      success: false,
      error: {
        code: 'COACHING_ENDPOINT_MOVED',
        message: `该接口已重构，请使用 ${newEndpoint}`,
      },
    });
  };
}

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

  // =========================================================================
  // Coach list / profile
  // =========================================================================

  router.get(
    '/coaches',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          specialty: req.query.specialty as 'singles' | 'doubles' | 'footwork' | 'fitness' | 'tactics' | undefined,
        };
        const result = await service.getCoachList(query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

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

  router.get(
    '/coaches/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getCoachProfile(String(req.params.id));
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Group classes
  // =========================================================================

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

  router.get(
    '/group-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getGroupClassDetail(String(req.params.id));
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/group-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateGroupClass(String(req.params.id), userId, req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/group-classes/:id/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelGroupClass(String(req.params.id), userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/group-classes/:id/enroll',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.enrollGroupClass(String(req.params.id), userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/group-classes/:id/cancel-enrollment',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelEnrollment(String(req.params.id), userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Private lessons (unified)
  // =========================================================================

  router.post(
    '/private-lessons/availability',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createAvailability(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/coaches/:id/availability',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const options: { startDate?: string; endDate?: string } = {};
        if (req.query.startDate) options.startDate = String(req.query.startDate);
        if (req.query.endDate) options.endDate = String(req.query.endDate);
        const result = await service.getCoachAvailability(String(req.params.id), options);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // Legacy: POST /api/private-lessons/book — body { slotId, venueId }
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

  // New: POST /api/private-lessons/:id/book — body { venueId? }
  router.post(
    '/private-lessons/:id/book',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.bookLesson(
          String(req.params.id),
          userId,
          req.body?.venueId,
        );
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/private-lessons/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getPrivateLessonDetail(String(req.params.id), userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/private-lessons/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updatePrivateLesson(
          String(req.params.id),
          userId,
          req.body,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/private-lessons/:id/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelPrivateLesson(String(req.params.id), userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/private-lessons/:id/training-content',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const content = req.body?.trainingContent ?? '';
        const result = await service.updatePrivateLessonTrainingContent(
          String(req.params.id),
          userId,
          content,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/private-lessons/:id/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addPrivateLessonNote(
          String(req.params.id),
          userId,
          req.body,
        );
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/private-lessons/:id/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getPrivateLessonNotes(String(req.params.id), userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Enrollments / coach private lessons
  // =========================================================================

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
        const result = await service.getUserEnrollments(String(req.params.id), query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/coaches/:id/private-lessons',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          status: req.query.status as
            | 'scheduled'
            | 'in_progress'
            | 'completed'
            | 'cancelled'
            | 'expired'
            | undefined,
        };
        const result = await service.getCoachPrivateLessons(String(req.params.id), query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // =========================================================================
  // Coach Application (GA)
  // =========================================================================

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

  router.get(
    '/admin/coach-applications',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          status: req.query.status as 'pending' | 'approved' | 'rejected' | undefined,
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

  router.get(
    '/admin/coach-applications/:id',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getApplicationById(String(req.params.id));
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admin/coach-applications/:id/review',
    authMiddleware,
    adminAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const adminId = (req as AuthRequest).userId!;
        const result = await service.reviewCoachApplication(
          String(req.params.id),
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
  // Legacy /api/private-students/* — removed in unified refactor. Sub-task 3
  // introduces /api/coach-students/*. For now, return 501 to signal the move.
  // =========================================================================

  router.post('/private-students', authMiddleware, notImplemented('/api/coach-students'));
  router.get('/private-students', authMiddleware, notImplemented('/api/coach-students'));
  router.get(
    '/private-students/:id',
    authMiddleware,
    notImplemented('/api/coach-students/:studentId'),
  );
  router.delete(
    '/private-students/:id',
    authMiddleware,
    notImplemented('该功能已取消，请使用"我的学员"统一入口'),
  );
  router.post(
    '/private-students/:id/lessons',
    authMiddleware,
    notImplemented('/api/coach-students/:studentId/lessons'),
  );
  router.get(
    '/private-students/:id/lessons',
    authMiddleware,
    notImplemented('/api/coach-students/:studentId/lessons'),
  );
  router.get(
    '/private-students/:id/lessons/:lessonId',
    authMiddleware,
    notImplemented('/api/private-lessons/:id'),
  );
  router.put(
    '/private-students/:id/lessons/:lessonId',
    authMiddleware,
    notImplemented('/api/private-lessons/:id'),
  );
  router.post(
    '/private-students/:id/lessons/:lessonId/cancel',
    authMiddleware,
    notImplemented('/api/private-lessons/:id/cancel'),
  );
  router.put(
    '/private-students/:id/lessons/:lessonId/training-content',
    authMiddleware,
    notImplemented('/api/private-lessons/:id/training-content'),
  );
  router.post(
    '/private-students/:id/lessons/:lessonId/notes',
    authMiddleware,
    notImplemented('/api/private-lessons/:id/notes'),
  );
  router.get(
    '/private-students/:id/lessons/:lessonId/notes',
    authMiddleware,
    notImplemented('/api/private-lessons/:id/notes'),
  );
  router.post(
    '/private-students/:id/notes',
    authMiddleware,
    notImplemented('/api/coach-students/:studentId/notes'),
  );
  router.get(
    '/private-students/:id/notes',
    authMiddleware,
    notImplemented('/api/coach-students/:studentId/notes'),
  );
  router.put(
    '/private-students/:id/tags',
    authMiddleware,
    notImplemented('/api/coach-students/:studentId/tags'),
  );
  router.get(
    '/private-students/:id/tags',
    authMiddleware,
    notImplemented('/api/coach-students/:studentId/tags'),
  );

  // =========================================================================
  // Student Class (GB) — unchanged
  // =========================================================================

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

  router.get(
    '/student-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getStudentClassDetail(userId, String(req.params.id));
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/student-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateStudentClass(userId, String(req.params.id), req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/student-classes/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.deleteStudentClass(userId, String(req.params.id));
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/student-classes/:id/members',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addStudentToClass(userId, String(req.params.id), req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/student-classes/:id/members/:studentId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.removeStudentFromClass(
          userId,
          String(req.params.id),
          String(req.params.studentId),
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/student-classes/:id/lessons',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createClassLesson(userId, String(req.params.id), req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/student-classes/:id/lessons',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          status: req.query.status as
            | 'scheduled'
            | 'in_progress'
            | 'completed'
            | 'cancelled'
            | undefined,
        };
        const result = await service.getClassLessons(userId, String(req.params.id), query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/student-classes/:id/lessons/:lessonId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getClassLessonDetail(
          userId,
          String(req.params.id),
          String(req.params.lessonId),
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/student-classes/:id/lessons/:lessonId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateClassLesson(
          userId,
          String(req.params.id),
          String(req.params.lessonId),
          req.body,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/student-classes/:id/lessons/:lessonId/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelClassLesson(
          userId,
          String(req.params.id),
          String(req.params.lessonId),
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/student-classes/:id/lessons/:lessonId/training-content',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateClassLessonTrainingContent(
          userId,
          String(req.params.id),
          String(req.params.lessonId),
          req.body,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/student-classes/:id/lessons/:lessonId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addClassLessonNote(
          userId,
          String(req.params.id),
          String(req.params.lessonId),
          req.body,
        );
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/student-classes/:id/lessons/:lessonId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getClassLessonNotes(
          userId,
          String(req.params.id),
          String(req.params.lessonId),
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/student-classes/:id/members/:studentId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.addStudentNote(
          userId,
          String(req.params.id),
          String(req.params.studentId),
          req.body,
        );
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/student-classes/:id/members/:studentId/notes',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getStudentNotes(
          userId,
          String(req.params.id),
          String(req.params.studentId),
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/student-classes/:id/members/:studentId/tags',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.setStudentTags(
          userId,
          String(req.params.id),
          String(req.params.studentId),
          req.body,
        );
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/student-classes/:id/members/:studentId/tags',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getStudentTags(
          userId,
          String(req.params.id),
          String(req.params.studentId),
        );
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
