import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { logger } from './logger.js';

/**
 * Middleware: inject a unique requestId into every request.
 * Downstream code accesses it via `req.requestId`.
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID();
  req.requestId = requestId;
  next();
}

/**
 * Middleware: log incoming request and outgoing response with timing.
 * Health check requests are logged at debug level to reduce noise.
 */
export function requestLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    };
    const logMessage = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;

    if (req.path === '/api/health') {
      logger.debug(logData, logMessage);
    } else {
      logger.info(logData, logMessage);
    }
  });

  next();
}
