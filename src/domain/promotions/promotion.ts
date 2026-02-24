import type { CartItem } from '../entities/cart-item.js';
import type { Money } from '../entities/money.js';
import type { ProductCode } from '../entities/product.js';

export interface PromotionResult {
  readonly totalPrice: Money;
  readonly description: string;
  readonly promotionId: string;
}

export interface Promotion {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly eligibleProducts: readonly ProductCode[];

  isApplicable(item: CartItem): boolean;
  apply(item: CartItem): PromotionResult | null;
}
