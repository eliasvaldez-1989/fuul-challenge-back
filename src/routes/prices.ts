import { Router } from 'express';
import type { AppDependencies } from '../types.js';
import { ALL_PRODUCT_CODES, PRODUCT_NAMES } from '../domain/entities/product.js';
import { logger } from '../infrastructure/logger/logger.js';
import { getRequestId } from '../middlewares/request-id.js';

const VALID_PROVIDERS = ['mock', 'opensea'] as const;

function isValidProvider(value: unknown): value is 'mock' | 'opensea' {
  return typeof value === 'string' && (VALID_PROVIDERS as readonly string[]).includes(value);
}

export function pricesRouter({ getProvider, promotions }: AppDependencies): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const reqId = getRequestId(req);
    const providerParam = req.query.provider;

    if (providerParam !== undefined && !isValidProvider(providerParam)) {
      res.status(400).json({ error: 'Invalid provider. Must be "mock" or "opensea".' });
      return;
    }

    try {
      const provider = getProvider(providerParam);
      const snapshot = await provider.getAllPrices();

      const products = ALL_PRODUCT_CODES
        .filter((code) => snapshot.prices.has(code))
        .map((code) => {
          const price = snapshot.prices.get(code)!;
          const applicablePromos = promotions
            .filter((p) => p.eligibleProducts.includes(code))
            .map((p) => p.name);
          return {
            code,
            name: PRODUCT_NAMES[code],
            priceWei: price.toWei().toString(),
            priceEth: price.toEthString(),
            promotions: applicablePromos,
          };
        });

      res.json({
        products,
        provider: providerParam || 'mock',
        fetchedAt: snapshot.fetchedAt.toISOString(),
      });
    } catch (err: unknown) {
      logger.error({ requestId: reqId, err }, 'Failed to fetch prices');
      res.status(500).json({ error: 'Failed to fetch prices' });
    }
  });

  return router;
}
