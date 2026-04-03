import { Router } from 'express';

export function createUserController(): Router {
  const router = Router();

  // POST /api/auth/send-code
  // POST /api/auth/login
  // GET /api/users/me
  // PUT /api/users/me
  // PUT /api/users/me/coach-role
  // GET /api/users/:id

  return router;
}
