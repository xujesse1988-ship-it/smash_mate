import { Request, Response, NextFunction } from 'express';

export function adminAuthMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  throw new Error('Not implemented');
  next();
}
