import type { CartItem } from '../entities/cart-item.js';
import type { ProductCode } from '../entities/product.js';
import type { Promotion, PromotionResult } from './promotion.js';

export class BulkDiscountPromotion implements Promotion {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly eligibleProducts: readonly ProductCode[];

  constructor(
    private readonly minQuantity: number,
    private readonly discountPercent: number,
    eligibleProducts: readonly ProductCode[],
    options: { id?: string; name?: string; priority?: number } = {},
  ) {
    if (discountPercent < 0 || discountPercent > 100) {
      throw new Error('Discount percent must be between 0 and 100');
    }
    this.eligibleProducts = eligibleProducts;
    this.id = options.id ?? `bulk${discountPercent}off`;
    this.name = options.name ?? `${discountPercent}% Bulk Discount (min ${minQuantity})`;
    this.priority = options.priority ?? 2;
  }

  isApplicable(item: CartItem): boolean {
    return this.eligibleProducts.includes(item.productCode);
  }

  apply(item: CartItem): PromotionResult | null {
    if (!this.isApplicable(item)) return null;
    if (item.quantity < this.minQuantity) return null;

    const keepPercent = BigInt(100 - this.discountPercent);
    const discountedUnitPrice = item.unitPrice.applyPercentage(keepPercent);
    const totalPrice = discountedUnitPrice.multiply(BigInt(item.quantity));

    return {
      totalPrice,
      description: `${this.name}: ${item.quantity} × ${discountedUnitPrice.toEthString()}`,
      promotionId: this.id,
    };
  }
}
