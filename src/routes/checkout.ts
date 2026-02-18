import { Router } from 'express';
import type { AppDependencies } from '../types.js';
import { createStrategy, isStrategyType } from '../domain/strategies/factory.js';
import { CheckoutService, CheckoutError } from '../application/services/checkout.js';
import { logger } from '../infrastructure/logger/logger.js';
import { getCorrelationId } from '../middlewares/correlation-id.js';

const VALID_PROVIDERS = ['mock', 'opensea'] as const;

function isValidProvider(value: unknown): value is 'mock' | 'opensea' {
  return typeof value === 'string' && (VALID_PROVIDERS as readonly string[]).includes(value);
}

export function checkoutRouter({ config, getProvider, promotions }: AppDependencies): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const cId = getCorrelationId(req);

    try {
      const { items, provider: providerParam, strategy: strategyParam } = req.body;

      if (providerParam !== undefined && !isValidProvider(providerParam)) {
        res.status(400).json({ error: 'Invalid provider. Must be "mock" or "opensea".' });
        return;
      }

      const rawStrategy = strategyParam || config.promotionStrategy;
      if (!isStrategyType(rawStrategy)) {
        res.status(400).json({ error: 'Invalid strategy. Must be "MIN", "PRIORITY", or "STACK".' });
        return;
      }

      const provider = getProvider(providerParam);
      const strategy = createStrategy(rawStrategy);

      const service = new CheckoutService(provider, promotions, strategy);
      const response = await service.calculateCheckout({ items });

      logger.info(
        { correlationId: cId, strategy: rawStrategy, itemCount: items?.length },
        'Checkout calculated',
      );

      res.json(response);
    } catch (err: unknown) {
      logger.error({ correlationId: cId, err }, 'Checkout failed');

      if (err instanceof CheckoutError) {
        res.status(400).json({ error: err.message });
        return;
      }

      res.status(500).json({ error: 'Checkout failed' });
    }
  });

  return router;
}
