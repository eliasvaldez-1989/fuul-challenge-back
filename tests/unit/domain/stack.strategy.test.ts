import { describe, it, expect } from 'vitest';
import { StackStrategy } from '../../../src/domain/strategies/stack.js';
import { BuyXGetYFreePromotion } from '../../../src/domain/promotions/buy-x-get-y-free.js';
import { BulkDiscountPromotion } from '../../../src/domain/promotions/bulk-discount.js';
import { Money } from '../../../src/domain/entities/money.js';
import type { CartItem } from '../../../src/domain/entities/cart-item.js';
import type { ProductCode } from '../../../src/domain/entities/product.js';

function item(code: ProductCode, qty: number, priceEth: bigint): CartItem {
  return { productCode: code, unitPrice: Money.fromEth(priceEth), quantity: qty };
}

describe('StackStrategy', () => {
  const strategy = new StackStrategy();
  const b2g1f = new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { id: 'b2g1f', priority: 1 });
  const bulk = new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], { id: 'bulk', priority: 2 });

  it('stacks two promotions multiplicatively', () => {
    const result = strategy.resolve(item('AZUKI', 3, 5n), [b2g1f, bulk]);
    // base = 15 ETH, B2G1F = 10, Bulk = 12
    // stacked: first = 10, then (10 * 12) / 15 = 8
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(8n).toWei());
    expect(result.promotionId).toBe('b2g1f+bulk');
    expect(result.description).toContain('Stacked');
  });

  it('applies single promo without stacking', () => {
    const result = strategy.resolve(item('APE', 3, 10n), [b2g1f, bulk]);
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(20n).toWei());
    expect(result.promotionId).toBe('b2g1f');
  });

  it('returns base price when no promo applies', () => {
    const result = strategy.resolve(item('MEEBIT', 5, 4n), [b2g1f, bulk]);
    expect(result.promotionId).toBe('none');
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(20n).toWei());
  });

  it('returns base price with empty promotions', () => {
    const result = strategy.resolve(item('APE', 2, 10n), []);
    expect(result.promotionId).toBe('none');
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(20n).toWei());
  });

  it('sorts by priority then by id for deterministic order', () => {
    const promoA = new BuyXGetYFreePromotion(2, 1, ['AZUKI'], { id: 'aaa', priority: 1 });
    const promoB = new BuyXGetYFreePromotion(2, 1, ['AZUKI'], { id: 'zzz', priority: 1 });
    const r1 = strategy.resolve(item('AZUKI', 3, 5n), [promoB, promoA]);
    const r2 = strategy.resolve(item('AZUKI', 3, 5n), [promoA, promoB]);
    expect(r1.totalPrice.toWei()).toBe(r2.totalPrice.toWei());
  });
});
