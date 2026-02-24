import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../../src/infrastructure/config/config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PROMOTION_STRATEGY;
    delete process.env.PRICE_CACHE_TTL_MS;
    delete process.env.OPENSEA_API_KEY;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns defaults when no env vars set', () => {
    const config = loadConfig();
    expect(config.promotionStrategy).toBe('MIN');
    expect(config.priceCacheTtlMs).toBe(60000);
    expect(config.openSeaApiKey).toBe('');
    expect(config.nodeEnv).toBe('development');
  });

  it('reads PROMOTION_STRATEGY', () => {
    process.env.PROMOTION_STRATEGY = 'STACK';
    expect(loadConfig().promotionStrategy).toBe('STACK');
  });

  it('accepts lowercase strategy and uppercases it', () => {
    process.env.PROMOTION_STRATEGY = 'priority';
    expect(loadConfig().promotionStrategy).toBe('PRIORITY');
  });

  it('throws on invalid strategy', () => {
    process.env.PROMOTION_STRATEGY = 'INVALID';
    expect(() => loadConfig()).toThrow(/Invalid PROMOTION_STRATEGY/);
  });

  it('reads PRICE_CACHE_TTL_MS', () => {
    process.env.PRICE_CACHE_TTL_MS = '30000';
    expect(loadConfig().priceCacheTtlMs).toBe(30000);
  });

  it('throws on non-numeric cache TTL', () => {
    process.env.PRICE_CACHE_TTL_MS = 'abc';
    expect(() => loadConfig()).toThrow(/Invalid PRICE_CACHE_TTL_MS/);
  });

  it('throws on negative cache TTL', () => {
    process.env.PRICE_CACHE_TTL_MS = '-1';
    expect(() => loadConfig()).toThrow(/Invalid PRICE_CACHE_TTL_MS/);
  });

  it('reads OPENSEA_API_KEY', () => {
    process.env.OPENSEA_API_KEY = 'test-key';
    expect(loadConfig().openSeaApiKey).toBe('test-key');
  });

  it('reads NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    expect(loadConfig().nodeEnv).toBe('production');
  });
});
