import { Router } from 'express';

export function createCoachingController(): Router {
  const router = Router();

  // GET /api/coaches
  // GET /api/coaches/:id
  // PUT /api/coaches/me
  // POST /api/group-classes
  // GET /api/group-classes/:id
  // PUT /api/group-classes/:id
  // POST /api/group-classes/:id/cancel
  // POST /api/group-classes/:id/enroll
  // POST /api/group-classes/:id/cancel-enrollment
  // POST /api/private-lessons/availability
  // GET /api/coaches/:id/availability
  // POST /api/private-lessons/book
  // POST /api/private-lessons/:id/cancel
  // GET /api/users/:id/enrollments
  // GET /api/coaches/:id/private-lessons

  return router;
}
