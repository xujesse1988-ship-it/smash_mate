import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function authMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  throw new Error('Not implemented');
  next();
}
