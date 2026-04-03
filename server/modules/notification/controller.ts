import { Router } from 'express';

export function createNotificationController(): Router {
  const router = Router();

  // GET /api/notifications
  // GET /api/notifications/unread-count
  // PUT /api/notifications/:id/read
  // PUT /api/notifications/read-all

  return router;
}
