import { describe, it, expect } from 'vitest';
import { PriorityStrategy } from '../../../src/domain/strategies/priority.js';
import { BuyXGetYFreePromotion } from '../../../src/domain/promotions/buy-x-get-y-free.js';
import { BulkDiscountPromotion } from '../../../src/domain/promotions/bulk-discount.js';
import { Money } from '../../../src/domain/entities/money.js';
import type { CartItem } from '../../../src/domain/entities/cart-item.js';
import type { ProductCode } from '../../../src/domain/entities/product.js';

function item(code: ProductCode, qty: number, priceEth: bigint): CartItem {
  return { productCode: code, unitPrice: Money.fromEth(priceEth), quantity: qty };
}

describe('PriorityStrategy', () => {
  const strategy = new PriorityStrategy();
  const b2g1f = new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { id: 'b2g1f', priority: 1 });
  const bulk = new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], { id: 'bulk', priority: 2 });

  it('picks highest-priority promo that applies', () => {
    const result = strategy.resolve(item('AZUKI', 3, 5n), [b2g1f, bulk]);
    expect(result.promotionId).toBe('b2g1f');
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(10n).toWei());
  });

  it('falls back to lower priority if higher does not apply', () => {
    const result = strategy.resolve(item('PUNK', 3, 8n), [b2g1f, bulk]);
    expect(result.promotionId).toBe('bulk');
  });

  it('returns base price when no promo triggers', () => {
    const result = strategy.resolve(item('AZUKI', 1, 5n), [b2g1f, bulk]);
    expect(result.promotionId).toBe('none');
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(5n).toWei());
  });

  it('returns base price with empty promotions list', () => {
    const result = strategy.resolve(item('APE', 3, 10n), []);
    expect(result.promotionId).toBe('none');
    expect(result.totalPrice.toWei()).toBe(Money.fromEth(30n).toWei());
  });
});
