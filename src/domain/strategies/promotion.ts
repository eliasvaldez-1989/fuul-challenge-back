import type { CartItem } from '../entities/cart-item.js';
import type { Promotion, PromotionResult } from '../promotions/promotion.js';

export interface PromotionStrategy {
  readonly name: string;
  resolve(
    item: CartItem,
    applicablePromotions: readonly Promotion[],
  ): PromotionResult;
}
