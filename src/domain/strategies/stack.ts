import type { CartItem } from '../entities/cart-item.js';
import { Money } from '../entities/money.js';
import type { Promotion, PromotionResult } from '../promotions/promotion.js';
import type { PromotionStrategy } from './promotion.js';

/**
 * Applies all eligible promotions via multiplicative stacking.
 * Sort: priority asc, id asc (tiebreaker). Ratios compose as (a/base * b/base * ...).
 */
export class StackStrategy implements PromotionStrategy {
  readonly name = 'STACK';

  resolve(item: CartItem, applicablePromotions: readonly Promotion[]): PromotionResult {
    const baseTotal = item.unitPrice.multiply(BigInt(item.quantity));
    let currentTotal = baseTotal;
    const descriptions: string[] = [];
    const appliedIds: string[] = [];

    const sorted = [...applicablePromotions].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id.localeCompare(b.id);
    });

    for (const promo of sorted) {
      const result = promo.apply(item);
      if (result !== null) {
        if (appliedIds.length === 0) {
          currentTotal = result.totalPrice;
        } else {
          const currentWei = currentTotal.toWei();
          const resultWei = result.totalPrice.toWei();
          const baseWei = baseTotal.toWei();
          if (baseWei > 0n) {
            currentTotal = Money.fromWei((currentWei * resultWei) / baseWei);
          }
        }
        descriptions.push(result.description);
        appliedIds.push(result.promotionId);
      }
    }

    if (appliedIds.length === 0) {
      return {
        totalPrice: baseTotal,
        description: `Base price: ${item.quantity} × ${item.unitPrice.toEthString()}`,
        promotionId: 'none',
      };
    }

    return {
      totalPrice: currentTotal,
      description: `Stacked: ${descriptions.join(' + ')}`,
      promotionId: appliedIds.join('+'),
    };
  }
}
