import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../infra/auth.js';
import { success, created } from '../../infra/response.js';
import { MatchRecordService } from './service.js';
import { MatchRecordRepository } from './repository.js';
import { ActivityService } from '../activity/service.js';
import { ActivityRepository } from '../activity/repository.js';
import { CoachingService } from '../coaching/service.js';
import { CoachingRepository } from '../coaching/repository.js';
import { VenueService } from '../venue/service.js';
import { VenueRepository } from '../venue/repository.js';
import { UserService } from '../user/service.js';
import { UserRepository } from '../user/repository.js';
import { NotificationService } from '../notification/service.js';
import { NotificationRepository } from '../notification/repository.js';

export function createMatchRecordController(): Router {
  const router = Router();

  // Wire up dependencies
  const matchRecordRepo = new MatchRecordRepository();
  const venueService = new VenueService(new VenueRepository());
  const userService = new UserService(new UserRepository());
  const notificationService = new NotificationService(new NotificationRepository());
  const activityService = new ActivityService(
    new ActivityRepository(),
    venueService,
    userService,
    notificationService,
  );
  const coachingService = new CoachingService(
    new CoachingRepository(),
    userService,
    venueService,
    notificationService,
  );
  const service = new MatchRecordService(
    matchRecordRepo,
    activityService,
    coachingService,
    userService,
  );

  // POST /api/match-records
  router.post(
    '/match-records',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createMatchRecord(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /api/match-records/:id
  router.delete(
    '/match-records/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.deleteMatchRecord(req.params.id, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/activities/:id/match-records
  router.get(
    '/activities/:id/match-records',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getSourceMatchRecords('activity', req.params.id, {});
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/group-classes/:id/match-records
  router.get(
    '/group-classes/:id/match-records',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getSourceMatchRecords('group-class', req.params.id, {});
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/private-lessons/:id/match-records
  router.get(
    '/private-lessons/:id/match-records',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getSourceMatchRecords('private-lesson', req.params.id, {});
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/users/:id/match-records
  router.get(
    '/users/:id/match-records',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
          sourceType: req.query.sourceType as
            | 'activity'
            | 'group-class'
            | 'private-lesson'
            | undefined,
        };
        const result = await service.getUserMatchRecords(req.params.id, query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/users/:id/match-stats
  router.get(
    '/users/:id/match-stats',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getUserMatchStats(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/**
 * Create a MatchRecordService instance for use by other modules or integration tests.
 * This factory creates the full dependency chain.
 */
export function createMatchRecordService(): MatchRecordService {
  const matchRecordRepo = new MatchRecordRepository();
  const venueService = new VenueService(new VenueRepository());
  const userService = new UserService(new UserRepository());
  const notificationService = new NotificationService(new NotificationRepository());
  const activityService = new ActivityService(
    new ActivityRepository(),
    venueService,
    userService,
    notificationService,
  );
  const coachingService = new CoachingService(
    new CoachingRepository(),
    userService,
    venueService,
    notificationService,
  );
  return new MatchRecordService(matchRecordRepo, activityService, coachingService, userService);
}
