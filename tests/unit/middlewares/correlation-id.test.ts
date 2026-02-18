import { describe, it, expect, vi } from 'vitest';
import { correlationId, getCorrelationId } from '../../../src/middlewares/correlation-id.js';
import type { Request, Response, NextFunction } from 'express';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): Response {
  return { setHeader: vi.fn() } as unknown as Response;
}

describe('correlationId middleware', () => {
  it('generates UUID when no header present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    correlationId(req, res, next);

    expect(req.headers['x-correlation-id']).toBeDefined();
    expect(req.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', req.headers['x-correlation-id']);
    expect(next).toHaveBeenCalled();
  });

  it('preserves existing correlation ID', () => {
    const req = mockReq({ 'x-correlation-id': 'existing-id' });
    const res = mockRes();
    const next = vi.fn();

    correlationId(req, res, next);

    expect(req.headers['x-correlation-id']).toBe('existing-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'existing-id');
  });
});

describe('getCorrelationId', () => {
  it('returns correlation ID from headers', () => {
    const req = mockReq({ 'x-correlation-id': 'test-id' });
    expect(getCorrelationId(req)).toBe('test-id');
  });

  it('returns "unknown" when no header', () => {
    const req = mockReq();
    expect(getCorrelationId(req)).toBe('unknown');
  });
});
