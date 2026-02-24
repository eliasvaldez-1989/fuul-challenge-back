import { describe, it, expect, vi } from 'vitest';
import { requestId, getRequestId } from '../../../src/middlewares/request-id.js';
import type { Request, Response, NextFunction } from 'express';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): Response {
  return { setHeader: vi.fn() } as unknown as Response;
}

describe('requestId middleware', () => {
  it('generates UUID when no header present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requestId(req, res, next);

    expect(req.headers['x-request-id']).toBeDefined();
    expect(req.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.headers['x-request-id']);
    expect(next).toHaveBeenCalled();
  });

  it('preserves existing request ID', () => {
    const req = mockReq({ 'x-request-id': 'existing-id' });
    const res = mockRes();
    const next = vi.fn();

    requestId(req, res, next);

    expect(req.headers['x-request-id']).toBe('existing-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'existing-id');
  });
});

describe('getRequestId', () => {
  it('returns request ID from headers', () => {
    const req = mockReq({ 'x-request-id': 'test-id' });
    expect(getRequestId(req)).toBe('test-id');
  });

  it('returns "unknown" when no header', () => {
    const req = mockReq();
    expect(getRequestId(req)).toBe('unknown');
  });
});
