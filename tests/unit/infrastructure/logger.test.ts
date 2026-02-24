import { describe, it, expect, vi, afterEach } from 'vitest';

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.resetModules();
  });

  it('creates logger in production mode', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    const mod = await import('../../../src/infrastructure/logger/logger.js');
    expect(mod.logger).toBeDefined();
    expect(mod.logger.level).toBe('info');
  });

  it('creates logger in development mode', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'development';
    const mod = await import('../../../src/infrastructure/logger/logger.js');
    expect(mod.logger).toBeDefined();
  });
});
