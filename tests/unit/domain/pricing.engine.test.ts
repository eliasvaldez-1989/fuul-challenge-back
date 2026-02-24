import { describe, it, expect } from 'vitest';
import { PricingEngine } from '../../../src/domain/engines/pricing.js';
import { MinStrategy } from '../../../src/domain/strategies/min.js';
import { BuyXGetYFreePromotion } from '../../../src/domain/promotions/buy-x-get-y-free.js';
import { BulkDiscountPromotion } from '../../../src/domain/promotions/bulk-discount.js';
import { Money } from '../../../src/domain/entities/money.js';
import type { CartItem } from '../../../src/domain/entities/cart-item.js';

/**
 * Tests use fixed prices so we can assert exact totals.
 * The promotion math is the same regardless of price source.
 */
const PRICES = {
  APE: Money.fromEth(10n),
  PUNK: Money.fromEth(8n),
  AZUKI: Money.fromEth(5n),
  MEEBIT: Money.fromEth(1n),
};

function item(code: keyof typeof PRICES, qty: number): CartItem {
  return { productCode: code, unitPrice: PRICES[code], quantity: qty };
}

describe('PricingEngine with MIN strategy', () => {
  const promotions = [
    new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], {
      id: 'buy2get1free',
      priority: 1,
    }),
    new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], {
      id: 'bulk20',
      priority: 2,
    }),
  ];
  const engine = new PricingEngine(promotions, new MinStrategy());

  it('empty cart → grand total = 0', () => {
    const result = engine.calculate([]);
    expect(result.grandTotal.toWei()).toBe(0n);
    expect(result.lineItems).toHaveLength(0);
  });

  describe('challenge scenarios', () => {
    it('APE, PUNK, MEEBIT → base prices (no promos)', () => {
      const result = engine.calculate([item('APE', 1), item('PUNK', 1), item('MEEBIT', 1)]);
      // 10 + 8 + 1 = 19
      expect(result.grandTotal.toWei()).toBe(Money.fromEth(19n).toWei());
    });

    it('APE×2, PUNK×1 → no promos (2 APE < 3 for B2G1F)', () => {
      const result = engine.calculate([item('APE', 2), item('PUNK', 1)]);
      // 2×10 + 8 = 28
      expect(result.grandTotal.toWei()).toBe(Money.fromEth(28n).toWei());
    });

    it('PUNK×4, APE×1 → bulk on PUNK', () => {
      const result = engine.calculate([item('PUNK', 4), item('APE', 1)]);
      // PUNK: 4 × (8 × 0.8) = 4 × 6.4 = 25.6 ETH
      // APE: 10
      // Total: 35.6 ETH
      const punkDiscounted = PRICES.PUNK.applyPercentage(80n).multiply(4n);
      const expected = punkDiscounted.add(PRICES.APE);
      expect(result.grandTotal.toWei()).toBe(expected.toWei());
    });

    it('APE×3, PUNK×3, MEEBIT×1 → B2G1F on APE, bulk on PUNK', () => {
      const result = engine.calculate([
        item('APE', 3),
        item('PUNK', 3),
        item('MEEBIT', 1),
      ]);
      // APE: B2G1F → pay for 2 × 10 = 20
      // PUNK: bulk → 3 × (8 × 0.8) = 3 × 6.4 = 19.2
      // MEEBIT: 1
      // Total: 40.2 ETH
      const apeTotal = PRICES.APE.multiply(2n);
      const punkTotal = PRICES.PUNK.applyPercentage(80n).multiply(3n);
      const expected = apeTotal.add(punkTotal).add(PRICES.MEEBIT);
      expect(result.grandTotal.toWei()).toBe(expected.toWei());
    });

    it('AZUKI×3 → MIN picks B2G1F (2×price < 3×price×0.8)', () => {
      const result = engine.calculate([item('AZUKI', 3)]);
      // B2G1F: 2 × 5 = 10
      // Bulk:  3 × 4 = 12
      // MIN picks 10
      expect(result.grandTotal.toWei()).toBe(Money.fromEth(10n).toWei());
    });
  });

  describe('edge cases', () => {
    it('single item, no promo → base price', () => {
      const result = engine.calculate([item('APE', 1)]);
      expect(result.grandTotal.toWei()).toBe(Money.fromEth(10n).toWei());
    });

    it('MEEBIT has no promotions → always base price', () => {
      const result = engine.calculate([item('MEEBIT', 100)]);
      expect(result.grandTotal.toWei()).toBe(Money.fromEth(100n).toWei());
    });

    it('lineItems contain correct per-product breakdown', () => {
      const result = engine.calculate([item('APE', 3), item('MEEBIT', 2)]);
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].productCode).toBe('APE');
      expect(result.lineItems[0].promotionApplied).toBe('buy2get1free');
      expect(result.lineItems[1].productCode).toBe('MEEBIT');
      expect(result.lineItems[1].promotionApplied).toBe('none');
    });
  });
});
