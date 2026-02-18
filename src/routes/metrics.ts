import { Router } from 'express';

interface MetricsState {
  requestCount: number;
  errorCount: number;
  startedAt: number;
}

const state: MetricsState = {
  requestCount: 0,
  errorCount: 0,
  startedAt: Date.now(),
};

export function trackRequest() {
  state.requestCount++;
}

export function trackError() {
  state.errorCount++;
}

export function metricsRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const uptimeMs = Date.now() - state.startedAt;
    const memUsage = process.memoryUsage();

    res.json({
      uptime_seconds: Math.floor(uptimeMs / 1000),
      requests_total: state.requestCount,
      errors_total: state.errorCount,
      memory: {
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    });
  });

  return router;
}
