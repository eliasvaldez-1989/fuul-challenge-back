import type { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/logger/logger.js';
import { getRequestId } from './request-id.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: getRequestId(req),
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'request completed');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'request completed');
    } else {
      logger.info(logData, 'request completed');
    }
  });

  next();
}
