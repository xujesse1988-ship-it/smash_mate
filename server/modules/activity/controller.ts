import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../infra/auth.js';
import { success, created } from '../../infra/response.js';
import { ActivityService } from './service.js';
import { ActivityRepository } from './repository.js';
import { VenueService } from '../venue/service.js';
import { VenueRepository } from '../venue/repository.js';
import { UserService } from '../user/service.js';
import { UserRepository } from '../user/repository.js';
import { NotificationService } from '../notification/service.js';
import { NotificationRepository } from '../notification/repository.js';

export function createActivityController(): Router {
  const router = Router();

  // Wire up dependencies
  const activityRepo = new ActivityRepository();
  const venueService = new VenueService(new VenueRepository());
  const userService = new UserService(new UserRepository());
  const notificationService = new NotificationService(new NotificationRepository());
  const service = new ActivityService(activityRepo, venueService, userService, notificationService);

  // Register scheduled tasks
  service.registerScheduledTasks();

  // POST /api/activities
  router.post(
    '/activities',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createActivity(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/activities
  router.get(
    '/activities',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          dateFilter: req.query.dateFilter as 'today' | 'tomorrow' | 'this_week' | undefined,
          dateStart: req.query.dateStart as string | undefined,
          dateEnd: req.query.dateEnd as string | undefined,
          maxDistance: req.query.maxDistance !== undefined ? Number(req.query.maxDistance) : undefined,
          latitude: req.query.latitude !== undefined ? Number(req.query.latitude) : undefined,
          longitude: req.query.longitude !== undefined ? Number(req.query.longitude) : undefined,
          hasSlot: req.query.hasSlot === 'true' ? true : req.query.hasSlot === 'false' ? false : undefined,
          sortBy: req.query.sortBy as 'time' | 'distance' | undefined,
        };

        const result = await service.getActivityList(query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/activities/:id
  router.get(
    '/activities/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getActivityDetail(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/activities/:id/join
  router.post(
    '/activities/:id/join',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.joinActivity(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/activities/:id/leave
  router.post(
    '/activities/:id/leave',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.leaveActivity(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/activities/:id
  router.put(
    '/activities/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateActivity(req.params.id, userId, req.body);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/activities/:id/cancel
  router.post(
    '/activities/:id/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.cancelActivity(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/users/:id/activities
  router.get(
    '/users/:id/activities',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          role: req.query.role as 'creator' | 'participant' | undefined,
          status: req.query.status as any,
        };

        const result = await service.getUserActivities(req.params.id, query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/**
 * Create an ActivityService instance for use by other modules or integration tests.
 * This factory creates the full dependency chain.
 */
export function createActivityService(): ActivityService {
  const activityRepo = new ActivityRepository();
  const venueService = new VenueService(new VenueRepository());
  const userService = new UserService(new UserRepository());
  const notificationService = new NotificationService(new NotificationRepository());
  return new ActivityService(activityRepo, venueService, userService, notificationService);
}
