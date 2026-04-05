import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../infra/auth.js';
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
        const result = await service.getCoachAvailability(req.params.id);
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
