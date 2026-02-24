import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

export function requestId(req: Request, _res: Response, next: NextFunction) {
  const id = (req.headers[HEADER] as string) ?? crypto.randomUUID();
  req.headers[HEADER] = id;
  _res.setHeader(HEADER, id);
  next();
}

export function getRequestId(req: Request): string {
  return (req.headers[HEADER] as string) ?? 'unknown';
}
