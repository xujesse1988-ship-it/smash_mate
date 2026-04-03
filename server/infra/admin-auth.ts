import { Request, Response, NextFunction } from 'express';
import { prisma } from './database.js';
import { config } from './config.js';
import { AppError } from './error-handler.js';
import { AuthRequest } from './auth.js';

/**
 * Middleware: verify the authenticated user is an admin.
 * Must be used AFTER authMiddleware (req.userId must be set).
 * Checks if the user's phone number is in the configured ADMIN_PHONES list.
 */
export async function adminAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = (req as AuthRequest).userId;

  if (!userId) {
    throw new AppError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });

  if (!user || !config.adminPhones.includes(user.phone)) {
    throw new AppError(403, 'AUTH_ADMIN_REQUIRED', '需要管理员权限');
  }

  next();
}
