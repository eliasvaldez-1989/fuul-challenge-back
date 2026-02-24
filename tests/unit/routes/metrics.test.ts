import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { metricsRouter, trackRequest, trackError } from '../../../src/routes/metrics.js';

describe('metrics route', () => {
  it('GET /metrics returns uptime and counters', async () => {
    const app = express();
    app.use('/metrics', metricsRouter());

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.requests_total).toBe('number');
    expect(typeof res.body.errors_total).toBe('number');
    expect(res.body.memory.rss_mb).toBeGreaterThan(0);
    expect(res.body.memory.heap_used_mb).toBeGreaterThan(0);
    expect(res.body.memory.heap_total_mb).toBeGreaterThan(0);
  });

  it('trackRequest increments request counter', async () => {
    const app = express();
    app.use('/metrics', metricsRouter());

    const before = (await request(app).get('/metrics')).body.requests_total;
    trackRequest();
    const after = (await request(app).get('/metrics')).body.requests_total;
    expect(after).toBe(before + 1);
  });

  it('trackError increments error counter', async () => {
    const app = express();
    app.use('/metrics', metricsRouter());

    const before = (await request(app).get('/metrics')).body.errors_total;
    trackError();
    const after = (await request(app).get('/metrics')).body.errors_total;
    expect(after).toBe(before + 1);
  });
});
