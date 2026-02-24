import type { CartItem } from '../entities/cart-item.js';
import type { Promotion, PromotionResult } from '../promotions/promotion.js';
import type { PromotionStrategy } from './promotion.js';

export class MinStrategy implements PromotionStrategy {
  readonly name = 'MIN';

  resolve(item: CartItem, applicablePromotions: readonly Promotion[]): PromotionResult {
    const baseTotal = item.unitPrice.multiply(BigInt(item.quantity));
    let best: PromotionResult = {
      totalPrice: baseTotal,
      description: `Base price: ${item.quantity} × ${item.unitPrice.toEthString()}`,
      promotionId: 'none',
    };

    for (const promo of applicablePromotions) {
      const result = promo.apply(item);
      if (result !== null && result.totalPrice.isLessThan(best.totalPrice)) {
        best = result;
      }
    }

    return best;
  }
}
