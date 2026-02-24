import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { healthRouter } from '../../../src/routes/health.js';
import type { AppDependencies } from '../../../src/types.js';

function createApp(openSeaAvailable = true) {
  const app = express();
  const deps = {
    config: { promotionStrategy: 'MIN', nodeEnv: 'test', openSeaApiKey: '', priceCacheTtlMs: 60000 },
    getProvider: () => { throw new Error('not needed'); },
    promotions: [],
    openSeaAvailable,
  } as unknown as AppDependencies;

  app.use('/health', healthRouter(deps));
  return app;
}

describe('health routes', () => {
  it('GET /health returns status and config', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.openSeaAvailable).toBe(true);
    expect(res.body.defaultStrategy).toBe('MIN');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /health reports openSeaAvailable=false', async () => {
    const res = await request(createApp(false)).get('/health');
    expect(res.body.openSeaAvailable).toBe(false);
  });

  it('GET /health/live returns ok', async () => {
    const res = await request(createApp()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
