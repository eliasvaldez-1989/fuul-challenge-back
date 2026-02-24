import { Router } from 'express';
import type { AppDependencies } from '../types.js';

export function healthRouter({ config, openSeaAvailable }: AppDependencies): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      openSeaAvailable,
      defaultStrategy: config.promotionStrategy,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
