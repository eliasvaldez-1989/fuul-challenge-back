import { describe, it, expect } from 'vitest';
import { MinStrategy } from '../../../src/domain/strategies/min.js';
import { BuyXGetYFreePromotion } from '../../../src/domain/promotions/buy-x-get-y-free.js';
import { BulkDiscountPromotion } from '../../../src/domain/promotions/bulk-discount.js';
import { Money } from '../../../src/domain/entities/money.js';
import type { CartItem } from '../../../src/domain/entities/cart-item.js';

describe('MinStrategy', () => {
  const strategy = new MinStrategy();
  const b2g1f = new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { priority: 1 });
  const bulk20 = new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], { priority: 2 });
  const allPromos = [b2g1f, bulk20];

  function item(code: string, qty: number, priceEth: bigint): CartItem {
    return { productCode: code as any, unitPrice: Money.fromEth(priceEth), quantity: qty };
  }

  describe('AZUKI dual-eligibility', () => {
    it('qty 3: picks B2G1F (60 ETH < Bulk 72 ETH)', () => {
      const azuki3 = item('AZUKI', 3, 30n);
      const result = strategy.resolve(azuki3, allPromos);
      // B2G1F: 2 × 30 = 60 ETH
      // Bulk:  3 × 24 = 72 ETH
      // MIN picks 60
      expect(result.totalPrice.toWei()).toBe(Money.fromEth(60n).toWei());
      expect(result.promotionId).toContain('buy2get1free');
    });

    it('qty 6: picks B2G1F (120 ETH < Bulk 144 ETH)', () => {
      const azuki6 = item('AZUKI', 6, 30n);
      const result = strategy.resolve(azuki6, allPromos);
      // B2G1F: 4 × 30 = 120 ETH
      // Bulk:  6 × 24 = 144 ETH
      expect(result.totalPrice.toWei()).toBe(Money.fromEth(120n).toWei());
    });

    it('qty 2: neither promo triggers → base price', () => {
      const azuki2 = item('AZUKI', 2, 30n);
      const result = strategy.resolve(azuki2, allPromos);
      // B2G1F needs 3, Bulk needs 3 → base: 2 × 30 = 60 ETH
      expect(result.totalPrice.toWei()).toBe(Money.fromEth(60n).toWei());
      expect(result.promotionId).toBe('none');
    });
  });

  describe('single-promo products', () => {
    it('APE qty 3: B2G1F applies, bulk does not', () => {
      const ape3 = item('APE', 3, 10n);
      const result = strategy.resolve(ape3, allPromos);
      // B2G1F: 2 × 10 = 20 ETH
      expect(result.totalPrice.toWei()).toBe(Money.fromEth(20n).toWei());
    });

    it('PUNK qty 3: bulk applies, B2G1F does not', () => {
      const punk3 = item('PUNK', 3, 60n);
      const result = strategy.resolve(punk3, allPromos);
      // Bulk: 3 × 48 = 144 ETH
      expect(result.totalPrice.toWei()).toBe(Money.fromEth(144n).toWei());
    });
  });

  it('no applicable promotions → base price', () => {
    const meebit = item('MEEBIT', 5, 4n);
    const result = strategy.resolve(meebit, allPromos);
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(20n).toWei());
    expect(result.promotionId).toBe('none');
  });

  it('empty promotions list → base price', () => {
    const ape = item('APE', 3, 10n);
    const result = strategy.resolve(ape, []);
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(30n).toWei());
    expect(result.promotionId).toBe('none');
  });
});
