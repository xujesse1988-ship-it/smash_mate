import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../infra/auth.js';
import { success } from '../../infra/response.js';
import { NotificationService } from './service.js';
import { NotificationRepository } from './repository.js';

export function createNotificationController(): Router {
  const router = Router();
  const repo = new NotificationRepository();
  const service = new NotificationService(repo);

  // Register scheduled tasks (notification cleanup)
  service.registerScheduledTasks();

  // GET /api/notifications/unread-count
  // NOTE: This route must be registered before /api/notifications/:id/read
  // to avoid "unread-count" being matched as an :id parameter.
  router.get(
    '/notifications/unread-count',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getUnreadCount(userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/notifications/read-all
  // NOTE: This route must be registered before /api/notifications/:id/read
  // to avoid "read-all" being matched as an :id parameter.
  router.put(
    '/notifications/read-all',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.markAllAsRead(userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/notifications
  router.get(
    '/notifications',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
        const pageSize = req.query.pageSize
          ? parseInt(req.query.pageSize as string, 10)
          : undefined;

        let isRead: boolean | undefined;
        if (req.query.isRead === 'true') {
          isRead = true;
        } else if (req.query.isRead === 'false') {
          isRead = false;
        }

        const result = await service.getNotifications(userId, { page, pageSize, isRead });
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/notifications/:id/read
  router.put(
    '/notifications/:id/read',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const notificationId = String(req.params.id);
        const result = await service.markAsRead(notificationId, userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
