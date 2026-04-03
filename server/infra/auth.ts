import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { AppError } from './error-handler.js';

export interface AuthRequest extends Request {
  userId?: string;
}

interface JwtPayload {
  userId: string;
}

/**
 * Middleware: verify JWT Bearer token and set `req.userId`.
 * Returns 401 if token is missing, invalid, or expired.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTH_REQUIRED', '请先登录');
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    (req as AuthRequest).userId = decoded.userId;
    next();
  } catch {
    throw new AppError(401, 'AUTH_TOKEN_INVALID', '登录已过期，请重新登录');
  }
}
