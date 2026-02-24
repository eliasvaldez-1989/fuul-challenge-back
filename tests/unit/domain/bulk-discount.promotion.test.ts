import { describe, it, expect } from 'vitest';
import { BulkDiscountPromotion } from '../../../src/domain/promotions/bulk-discount.js';
import { Money } from '../../../src/domain/entities/money.js';
import type { CartItem } from '../../../src/domain/entities/cart-item.js';

describe('BulkDiscountPromotion (20% off, min 3)', () => {
  const promo = new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI']);

  function item(code: string, qty: number, priceEth: bigint): CartItem {
    return { productCode: code as any, unitPrice: Money.fromEth(priceEth), quantity: qty };
  }

  it('returns null for qty 1 (below threshold)', () => {
    expect(promo.apply(item('PUNK', 1, 60n))).toBeNull();
  });

  it('returns null for qty 2 (below threshold)', () => {
    expect(promo.apply(item('PUNK', 2, 60n))).toBeNull();
  });

  it('qty 3: 20% discount on each unit', () => {
    const result = promo.apply(item('PUNK', 3, 60n))!;
    // 3 × (60 × 0.8) = 3 × 48 = 144 ETH
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(144n).toWei());
  });

  it('qty 4: 20% discount on each unit', () => {
    const result = promo.apply(item('PUNK', 4, 60n))!;
    // 4 × 48 = 192 ETH
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(192n).toWei());
  });

  it('qty 5: 20% discount on each unit', () => {
    const result = promo.apply(item('PUNK', 5, 60n))!;
    // 5 × 48 = 240 ETH
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(240n).toWei());
  });

  it('applies to AZUKI', () => {
    const result = promo.apply(item('AZUKI', 3, 30n))!;
    // 3 × (30 × 0.8) = 3 × 24 = 72 ETH
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(72n).toWei());
  });

  it('returns null for non-eligible product', () => {
    expect(promo.apply(item('APE', 3, 75n))).toBeNull();
  });

  it('isApplicable returns true for eligible product', () => {
    expect(promo.isApplicable(item('PUNK', 1, 60n))).toBe(true);
  });

  it('isApplicable returns false for non-eligible product', () => {
    expect(promo.isApplicable(item('APE', 1, 75n))).toBe(false);
  });

  it('throws on invalid discount percent', () => {
    expect(() => new BulkDiscountPromotion(3, 101, ['PUNK'])).toThrow();
    expect(() => new BulkDiscountPromotion(3, -1, ['PUNK'])).toThrow();
  });
});
