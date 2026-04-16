import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../infra/auth.js';
import { adminAuthMiddleware } from '../../infra/admin-auth.js';
import { AppError } from '../../infra/error-handler.js';
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

  // POST /api/auth/wx-login
  const wxLoginSchema = z.object({
    code: z.string().min(1),
    encryptedData: z.string().min(1),
    iv: z.string().min(1),
    isCoach: z.boolean().optional(),
  });

  router.post('/auth/wx-login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = wxLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'AUTH_INVALID_PARAMS', '请求参数不合法');
      }
      const result = await service.wxLogin(parsed.data);
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

  // GET /api/users/search — must be before /users/:id to avoid conflict
  router.get(
    '/users/search',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = req.query.q as string;
        const result = await service.searchUsers(q);
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

  // GET /api/users — 管理员专用，手机号已脱敏
  router.get(
    '/users',
    authMiddleware,
    adminAuthMiddleware,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getAllUsers();
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/admin/users — 管理员专用，返回未脱敏手机号
  router.get(
    '/admin/users',
    authMiddleware,
    adminAuthMiddleware,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getAllUsersForAdmin();
        success(res, result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
