import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../infra/auth.js';
import { success, created } from '../../infra/response.js';
import { ReviewService } from './service.js';
import { ReviewRepository } from './repository.js';
import { UserService } from '../user/service.js';
import { UserRepository } from '../user/repository.js';
import { CoachingService } from '../coaching/service.js';
import { CoachingRepository } from '../coaching/repository.js';
import { VenueService } from '../venue/service.js';
import { VenueRepository } from '../venue/repository.js';
import { NotificationService } from '../notification/service.js';
import { NotificationRepository } from '../notification/repository.js';

/**
 * Create a ReviewService instance with all dependencies wired up.
 */
export function createReviewService(): ReviewService {
  const reviewRepo = new ReviewRepository();
  const userService = new UserService(new UserRepository());
  const venueService = new VenueService(new VenueRepository());
  const notificationService = new NotificationService(new NotificationRepository());
  const coachingService = new CoachingService(
    new CoachingRepository(),
    userService,
    venueService,
    notificationService,
  );

  return new ReviewService(reviewRepo, userService, coachingService, notificationService);
}

export function createReviewController(): Router {
  const router = Router();
  const service = createReviewService();

  // POST /api/reviews
  router.post(
    '/reviews',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.createReview(userId, req.body);
        created(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/coaches/ratings (must be before /:id routes to avoid path conflict)
  router.post(
    '/coaches/ratings',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getCoachesRatings(req.body.coachIds);
        success(res, { ratings: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/coaches/:id/reviews
  router.get(
    '/coaches/:id/reviews',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = {
          page: req.query.page !== undefined ? Number(req.query.page) : undefined,
          pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined,
        };
        const result = await service.getCoachReviews(String(req.params.id), query);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/coaches/:id/rating
  router.get(
    '/coaches/:id/rating',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getCoachRating(String(req.params.id));
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
