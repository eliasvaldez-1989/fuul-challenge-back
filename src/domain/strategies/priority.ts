import type { CartItem } from '../entities/cart-item.js';
import type { Promotion, PromotionResult } from '../promotions/promotion.js';
import type { PromotionStrategy } from './promotion.js';

export class PriorityStrategy implements PromotionStrategy {
  readonly name = 'PRIORITY';

  resolve(item: CartItem, applicablePromotions: readonly Promotion[]): PromotionResult {
    const baseTotal = item.unitPrice.multiply(BigInt(item.quantity));
    const sorted = [...applicablePromotions].sort((a, b) => a.priority - b.priority);

    for (const promo of sorted) {
      const result = promo.apply(item);
      if (result !== null) return result;
    }

    return {
      totalPrice: baseTotal,
      description: `Base price: ${item.quantity} × ${item.unitPrice.toEthString()}`,
      promotionId: 'none',
    };
  }
}
