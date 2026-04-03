import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../infra/auth.js';
import { success } from '../../infra/response.js';
import { UserService } from './service.js';
import { UserRepository } from './repository.js';

export function createUserController(): Router {
  const router = Router();
  const repo = new UserRepository();
  const service = new UserService(repo);

  // POST /api/auth/send-code
  router.post('/auth/send-code', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.sendCode({ phone: req.body.phone });
      success(res, result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/login
  router.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.login({
        phone: req.body.phone,
        code: req.body.code,
        isCoach: req.body.isCoach,
      });
      success(res, result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/users/me
  router.get(
    '/users/me',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.getCurrentUser(userId);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/users/me
  router.put(
    '/users/me',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateProfile(userId, {
          nickname: req.body.nickname,
          avatarUrl: req.body.avatarUrl,
          bio: req.body.bio,
        });
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /api/users/me/coach-role
  router.put(
    '/users/me/coach-role',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthRequest).userId!;
        const result = await service.updateCoachRole(userId, req.body.isCoach);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/users/:id
  router.get(
    '/users/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getUserPublicInfo(req.params.id);
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
