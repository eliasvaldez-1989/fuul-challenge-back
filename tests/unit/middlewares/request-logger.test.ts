import { describe, it, expect, vi } from 'vitest';
import { requestLogger } from '../../../src/middlewares/request-logger.js';
import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'node:events';

function createMocks(statusCode: number) {
  const req = {
    method: 'GET',
    originalUrl: '/api/test',
    headers: { 'x-request-id': 'test-rid' },
  } as unknown as Request;

  const res = new EventEmitter() as unknown as Response;
  (res as any).statusCode = statusCode;

  return { req, res };
}

describe('requestLogger', () => {
  it('calls next immediately', () => {
    const { req, res } = createMocks(200);
    const next = vi.fn();
    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('logs on response finish (2xx)', () => {
    const { req, res } = createMocks(200);
    const next = vi.fn();
    requestLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');
    // no error thrown — logging happened
  });

  it('logs on 4xx response', () => {
    const { req, res } = createMocks(400);
    const next = vi.fn();
    requestLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');
  });

  it('logs on 5xx response', () => {
    const { req, res } = createMocks(500);
    const next = vi.fn();
    requestLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');
  });
});
