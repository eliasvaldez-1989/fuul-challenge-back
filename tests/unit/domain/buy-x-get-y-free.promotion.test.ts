import { describe, it, expect } from 'vitest';
import { BuyXGetYFreePromotion } from '../../../src/domain/promotions/buy-x-get-y-free.js';
import { Money } from '../../../src/domain/entities/money.js';
import type { CartItem } from '../../../src/domain/entities/cart-item.js';

describe('BuyXGetYFreePromotion (Buy 2 Get 1 Free)', () => {
  const promo = new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI']);

  function item(code: string, qty: number, priceEth: bigint): CartItem {
    return { productCode: code as any, unitPrice: Money.fromEth(priceEth), quantity: qty };
  }

  it('returns null for qty 1 (below group size of 3)', () => {
    expect(promo.apply(item('APE', 1, 10n))).toBeNull();
  });

  it('returns null for qty 2 (below group size of 3)', () => {
    expect(promo.apply(item('APE', 2, 10n))).toBeNull();
  });

  it('qty 3: pays for 2', () => {
    const result = promo.apply(item('APE', 3, 10n))!;
    expect(result).not.toBeNull();
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(20n).toWei());
  });

  it('qty 4: pays for 3 (1 group + 1 remainder)', () => {
    const result = promo.apply(item('APE', 4, 10n))!;
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(30n).toWei());
  });

  it('qty 6: pays for 4 (2 groups)', () => {
    const result = promo.apply(item('APE', 6, 10n))!;
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(40n).toWei());
  });

  it('qty 7: pays for 5 (2 groups + 1 remainder)', () => {
    const result = promo.apply(item('APE', 7, 10n))!;
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(50n).toWei());
  });

  it('applies to AZUKI', () => {
    const result = promo.apply(item('AZUKI', 3, 5n))!;
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(10n).toWei());
  });

  it('returns null for non-eligible product', () => {
    expect(promo.apply(item('PUNK', 3, 10n))).toBeNull();
  });

  it('isApplicable returns true for eligible product', () => {
    expect(promo.isApplicable(item('APE', 1, 10n))).toBe(true);
  });

  it('isApplicable returns false for non-eligible product', () => {
    expect(promo.isApplicable(item('MEEBIT', 1, 10n))).toBe(false);
  });
});
