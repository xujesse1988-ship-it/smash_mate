import { Router } from 'express';

export function createActivityController(): Router {
  const router = Router();

  // POST /api/activities
  // GET /api/activities
  // GET /api/activities/:id
  // POST /api/activities/:id/join
  // POST /api/activities/:id/leave
  // PUT /api/activities/:id
  // POST /api/activities/:id/cancel
  // GET /api/users/:id/activities

  return router;
}
