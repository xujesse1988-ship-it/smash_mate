import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    // Business errors at warn level (client mistakes, validation failures)
    logger.warn(
      {
        requestId: req.requestId,
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
      },
      `AppError: ${err.code}`,
    );

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Unexpected errors at error level
  logger.error(
    {
      requestId: req.requestId,
      error: err.message,
      stack: err.stack,
    },
    'Unhandled error',
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
    },
  });
}
