import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { checkoutRouter } from '../../../src/routes/checkout.js';
import { MockPriceProvider } from '../../../src/infrastructure/providers/mock-price.js';
import { BuyXGetYFreePromotion } from '../../../src/domain/promotions/buy-x-get-y-free.js';
import { BulkDiscountPromotion } from '../../../src/domain/promotions/bulk-discount.js';
import type { AppDependencies } from '../../../src/types.js';
import { requestId } from '../../../src/middlewares/request-id.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  const deps = {
    config: { promotionStrategy: 'MIN', nodeEnv: 'test', openSeaApiKey: '', priceCacheTtlMs: 60000 },
    getProvider: () => new MockPriceProvider(),
    promotions: [
      new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { id: 'b2g1f', priority: 1 }),
      new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], { id: 'bulk', priority: 2 }),
    ],
    openSeaAvailable: false,
  } as unknown as AppDependencies;

  app.use('/checkout', checkoutRouter(deps));
  return app;
}

describe('checkout route', () => {
  it('POST /checkout calculates total', async () => {
    const res = await request(createApp())
      .post('/checkout')
      .send({ items: [{ productCode: 'APE', quantity: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.grandTotalEth).toBe('75 ETH');
    expect(res.body.strategyUsed).toBe('MIN');
    expect(res.body.pricesFetchedAt).toBeDefined();
    expect(res.body.priceValidUntil).toBeDefined();
  });

  it('accepts strategy override', async () => {
    const res = await request(createApp())
      .post('/checkout')
      .send({ items: [{ productCode: 'AZUKI', quantity: 3 }], strategy: 'STACK' });
    expect(res.status).toBe(200);
    expect(res.body.strategyUsed).toBe('STACK');
  });

  it('rejects invalid provider', async () => {
    const res = await request(createApp())
      .post('/checkout')
      .send({ items: [{ productCode: 'APE', quantity: 1 }], provider: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid provider');
  });

  it('rejects invalid strategy', async () => {
    const res = await request(createApp())
      .post('/checkout')
      .send({ items: [{ productCode: 'APE', quantity: 1 }], strategy: 'INVALID' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid strategy');
  });

  it('returns 400 for empty cart', async () => {
    const res = await request(createApp())
      .post('/checkout')
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown product', async () => {
    const res = await request(createApp())
      .post('/checkout')
      .send({ items: [{ productCode: 'DOODLE', quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('returns 500 for internal errors', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestId);
    const deps = {
      config: { promotionStrategy: 'MIN' },
      getProvider: () => ({ getAllPrices: () => Promise.reject(new Error('boom')) }),
      promotions: [],
      openSeaAvailable: false,
    } as unknown as AppDependencies;
    app.use('/checkout', checkoutRouter(deps));

    const res = await request(app)
      .post('/checkout')
      .send({ items: [{ productCode: 'APE', quantity: 1 }] });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Checkout failed');
  });
});
