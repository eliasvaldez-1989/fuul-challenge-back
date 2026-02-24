import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pricesRouter } from '../../../src/routes/prices.js';
import { MockPriceProvider } from '../../../src/infrastructure/providers/mock-price.js';
import { BuyXGetYFreePromotion } from '../../../src/domain/promotions/buy-x-get-y-free.js';
import type { AppDependencies } from '../../../src/types.js';
import { requestId } from '../../../src/middlewares/request-id.js';

function createApp() {
  const app = express();
  app.use(requestId);
  const deps = {
    config: { promotionStrategy: 'MIN', nodeEnv: 'test', openSeaApiKey: '', priceCacheTtlMs: 60000 },
    getProvider: () => new MockPriceProvider(),
    promotions: [
      new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { id: 'b2g1f', name: 'Buy 2 Get 1 Free', priority: 1 }),
    ],
    openSeaAvailable: false,
  } as unknown as AppDependencies;

  app.use('/prices', pricesRouter(deps));
  return app;
}

describe('prices route', () => {
  it('GET /prices returns all products with default provider', async () => {
    const res = await request(createApp()).get('/prices');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(4);
    expect(res.body.provider).toBe('mock');
    expect(res.body.fetchedAt).toBeDefined();
  });

  it('GET /prices?provider=mock works', async () => {
    const res = await request(createApp()).get('/prices?provider=mock');
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('mock');
  });

  it('GET /prices?provider=invalid returns 400', async () => {
    const res = await request(createApp()).get('/prices?provider=invalid');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid provider');
  });

  it('products include promotion names', async () => {
    const res = await request(createApp()).get('/prices');
    const ape = res.body.products.find((p: any) => p.code === 'APE');
    expect(ape.promotions).toContain('Buy 2 Get 1 Free');
  });

  it('products include price in ETH and Wei', async () => {
    const res = await request(createApp()).get('/prices');
    const ape = res.body.products.find((p: any) => p.code === 'APE');
    expect(ape.priceEth).toBe('75 ETH');
    expect(ape.priceWei).toBeDefined();
  });

  it('handles provider errors with 500', async () => {
    const app = express();
    app.use(requestId);
    const deps = {
      config: { promotionStrategy: 'MIN' },
      getProvider: () => ({ getAllPrices: () => Promise.reject(new Error('boom')) }),
      promotions: [],
      openSeaAvailable: false,
    } as unknown as AppDependencies;
    app.use('/prices', pricesRouter(deps));

    const res = await request(app).get('/prices');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch prices');
  });
});
