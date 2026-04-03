import { Router } from 'express';

export function createReviewController(): Router {
  const router = Router();

  // POST /api/reviews
  // GET /api/coaches/:id/reviews
  // GET /api/coaches/:id/rating
  // POST /api/coaches/ratings

  return router;
}
