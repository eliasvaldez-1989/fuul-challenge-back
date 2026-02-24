import type { CartItem } from '../entities/cart-item.js';
import type { ProductCode } from '../entities/product.js';
import type { Promotion, PromotionResult } from './promotion.js';

export class BuyXGetYFreePromotion implements Promotion {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly eligibleProducts: readonly ProductCode[];

  constructor(
    private readonly buyCount: number,
    private readonly freeCount: number,
    eligibleProducts: readonly ProductCode[],
    options: { id?: string; name?: string; priority?: number } = {},
  ) {
    this.eligibleProducts = eligibleProducts;
    this.id = options.id ?? `buy${buyCount}get${freeCount}free`;
    this.name = options.name ?? `Buy ${buyCount} Get ${freeCount} Free`;
    this.priority = options.priority ?? 1;
  }

  isApplicable(item: CartItem): boolean {
    return this.eligibleProducts.includes(item.productCode);
  }

  apply(item: CartItem): PromotionResult | null {
    if (!this.isApplicable(item)) return null;

    const groupSize = this.buyCount + this.freeCount;
    if (item.quantity < groupSize) return null;

    const fullGroups = Math.floor(item.quantity / groupSize);
    const remainder = item.quantity % groupSize;
    const paidItems = fullGroups * this.buyCount + remainder;

    const totalPrice = item.unitPrice.multiply(BigInt(paidItems));

    return {
      totalPrice,
      description: `${this.name}: ${item.quantity} items, pay for ${paidItems}`,
      promotionId: this.id,
    };
  }
}
