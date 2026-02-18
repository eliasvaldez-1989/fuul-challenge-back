import { describe, it, expect } from 'vitest';
import { CheckoutService, CheckoutError } from '../../src/application/services/checkout.js';
import { MockPriceProvider } from '../../src/infrastructure/providers/mock-price.js';
import { BuyXGetYFreePromotion } from '../../src/domain/promotions/buy-x-get-y-free.js';
import { BulkDiscountPromotion } from '../../src/domain/promotions/bulk-discount.js';
import { MinStrategy } from '../../src/domain/strategies/min.js';
import { PriorityStrategy } from '../../src/domain/strategies/priority.js';
import { StackStrategy } from '../../src/domain/strategies/stack.js';
import { Money } from '../../src/domain/entities/money.js';

/**
 * Integration tests: full pipeline from CheckoutRequest DTO
 * through price resolution → promotion engine → CheckoutResponse DTO.
 */
describe('CheckoutService integration', () => {
  const prices = new Map([
    ['APE' as const, Money.fromEth(10n)],
    ['PUNK' as const, Money.fromEth(8n)],
    ['AZUKI' as const, Money.fromEth(5n)],
    ['MEEBIT' as const, Money.fromEth(1n)],
  ]);
  const promotions = [
    new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { id: 'buy2get1free', priority: 1 }),
    new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], { id: 'bulk20', priority: 2 }),
  ];

  describe('MIN strategy', () => {
    const service = new CheckoutService(
      new MockPriceProvider(prices),
      promotions,
      new MinStrategy(),
    );

    it('simple cart, no promos', async () => {
      const response = await service.calculateCheckout({
        items: [
          { productCode: 'APE', quantity: 1 },
          { productCode: 'PUNK', quantity: 1 },
          { productCode: 'MEEBIT', quantity: 1 },
        ],
      });
      expect(response.grandTotalEth).toBe('19 ETH');
      expect(response.strategyUsed).toBe('MIN');
      expect(response.lineItems).toHaveLength(3);
    });

    it('AZUKI×3 — MIN picks cheapest promo', async () => {
      const response = await service.calculateCheckout({
        items: [{ productCode: 'AZUKI', quantity: 3 }],
      });
      // B2G1F: 2 × 5 = 10 ETH
      // Bulk:  3 × 4 = 12 ETH
      // MIN → 10 ETH
      expect(response.grandTotalWei).toBe(Money.fromEth(10n).toWei().toString());
    });

    it('mixed cart with multiple promos', async () => {
      const response = await service.calculateCheckout({
        items: [
          { productCode: 'APE', quantity: 3 },
          { productCode: 'PUNK', quantity: 3 },
          { productCode: 'MEEBIT', quantity: 1 },
        ],
      });
      // APE B2G1F: 2 × 10 = 20
      // PUNK Bulk: 3 × 6.4 = 19.2
      // MEEBIT: 1
      const apeTotal = Money.fromEth(10n).multiply(2n);
      const punkTotal = Money.fromEth(8n).applyPercentage(80n).multiply(3n);
      const expected = apeTotal.add(punkTotal).add(Money.fromEth(1n));
      expect(response.grandTotalWei).toBe(expected.toWei().toString());
    });
  });

  describe('PRIORITY strategy', () => {
    const service = new CheckoutService(
      new MockPriceProvider(prices),
      promotions,
      new PriorityStrategy(),
    );

    it('AZUKI×3 — PRIORITY picks B2G1F (priority 1 > bulk priority 2)', async () => {
      const response = await service.calculateCheckout({
        items: [{ productCode: 'AZUKI', quantity: 3 }],
      });
      // B2G1F has priority 1 (higher), so it's applied
      expect(response.grandTotalWei).toBe(Money.fromEth(10n).toWei().toString());
      expect(response.lineItems[0].promotionApplied).toBe('buy2get1free');
    });
  });

  describe('STACK strategy', () => {
    const service = new CheckoutService(
      new MockPriceProvider(prices),
      promotions,
      new StackStrategy(),
    );

    it('AZUKI×3 — stacks both promotions', async () => {
      const response = await service.calculateCheckout({
        items: [{ productCode: 'AZUKI', quantity: 3 }],
      });
      // Base: 3 × 5 = 15 ETH
      // B2G1F: 10 ETH (ratio 10/15 = 2/3)
      // Bulk: 12 ETH (ratio 12/15 = 4/5)
      // Stacked: 15 × (2/3) × (4/5) = 10 × (4/5) = 8 ETH
      // In wei: (10 × 10^18 × 12 × 10^18) / (15 × 10^18) = 8 × 10^18
      expect(response.grandTotalWei).toBe(Money.fromEth(8n).toWei().toString());
    });
  });

  describe('validation', () => {
    const service = new CheckoutService(
      new MockPriceProvider(prices),
      promotions,
      new MinStrategy(),
    );

    it('empty cart throws CheckoutError', async () => {
      await expect(
        service.calculateCheckout({ items: [] }),
      ).rejects.toThrow(CheckoutError);
    });

    it('negative quantity throws CheckoutError', async () => {
      await expect(
        service.calculateCheckout({ items: [{ productCode: 'APE', quantity: -1 }] }),
      ).rejects.toThrow(CheckoutError);
    });

    it('zero quantity throws CheckoutError', async () => {
      await expect(
        service.calculateCheckout({ items: [{ productCode: 'APE', quantity: 0 }] }),
      ).rejects.toThrow(CheckoutError);
    });

    it('unknown product throws CheckoutError', async () => {
      await expect(
        service.calculateCheckout({ items: [{ productCode: 'DOODLE', quantity: 1 }] }),
      ).rejects.toThrow(CheckoutError);
    });

    it('too many items throws CheckoutError', async () => {
      const items = Array.from({ length: 51 }, (_, i) => ({ productCode: 'APE', quantity: 1 }));
      await expect(service.calculateCheckout({ items })).rejects.toThrow(/Too many items/);
    });

    it('quantity exceeding max throws CheckoutError', async () => {
      await expect(
        service.calculateCheckout({ items: [{ productCode: 'APE', quantity: 1001 }] }),
      ).rejects.toThrow(/Quantity too large/);
    });

    it('non-integer quantity throws CheckoutError', async () => {
      await expect(
        service.calculateCheckout({ items: [{ productCode: 'APE', quantity: 1.5 }] }),
      ).rejects.toThrow(CheckoutError);
    });

    it('missing productCode throws CheckoutError', async () => {
      await expect(
        service.calculateCheckout({ items: [{ productCode: '', quantity: 1 }] }),
      ).rejects.toThrow(CheckoutError);
    });

    it('null items throws CheckoutError', async () => {
      await expect(
        service.calculateCheckout({ items: null as any }),
      ).rejects.toThrow(CheckoutError);
    });

    it('throws when price unavailable for valid product', async () => {
      const partialProvider = new MockPriceProvider(
        new Map([['APE' as const, Money.fromEth(10n)]]),
      );
      const svc = new CheckoutService(partialProvider, promotions, new MinStrategy());
      await expect(
        svc.calculateCheckout({ items: [{ productCode: 'PUNK', quantity: 1 }] }),
      ).rejects.toThrow(/Price unavailable/);
    });

    it('response includes quote timestamps', async () => {
      const response = await service.calculateCheckout({
        items: [{ productCode: 'APE', quantity: 1 }],
      });
      expect(response.pricesFetchedAt).toBeDefined();
      expect(response.priceValidUntil).toBeDefined();
      const fetched = new Date(response.pricesFetchedAt).getTime();
      const valid = new Date(response.priceValidUntil).getTime();
      expect(valid - fetched).toBe(30_000);
    });
  });
});
