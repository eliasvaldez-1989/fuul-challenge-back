import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const HEADER = 'x-correlation-id';

export function correlationId(req: Request, _res: Response, next: NextFunction) {
  const id = (req.headers[HEADER] as string) ?? crypto.randomUUID();
  req.headers[HEADER] = id;
  _res.setHeader(HEADER, id);
  next();
}

export function getCorrelationId(req: Request): string {
  return (req.headers[HEADER] as string) ?? 'unknown';
}
