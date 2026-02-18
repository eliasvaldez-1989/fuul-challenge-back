import type { CartItem } from '../entities/cart-item.js';
import { Money } from '../entities/money.js';
import type { ProductCode } from '../entities/product.js';
import type { Promotion, PromotionResult } from '../promotions/promotion.js';
import type { PromotionStrategy } from '../strategies/promotion.js';

export interface PricingLineItem {
  readonly productCode: ProductCode;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
  readonly promotionApplied: string;
  readonly description: string;
}

export interface PricingResult {
  readonly lineItems: readonly PricingLineItem[];
  readonly grandTotal: Money;
}

export class PricingEngine {
  constructor(
    private readonly promotions: readonly Promotion[],
    private readonly strategy: PromotionStrategy,
  ) {}

  calculate(items: readonly CartItem[]): PricingResult {
    const lineItems: PricingLineItem[] = [];
    let grandTotal = Money.zero();

    for (const item of items) {
      const applicable = this.promotions.filter((p) => p.isApplicable(item));

      const result: PromotionResult =
        applicable.length > 0
          ? this.strategy.resolve(item, applicable)
          : {
              totalPrice: item.unitPrice.multiply(BigInt(item.quantity)),
              description: `Base price: ${item.quantity} × ${item.unitPrice.toEthString()}`,
              promotionId: 'none',
            };

      lineItems.push({
        productCode: item.productCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: result.totalPrice,
        promotionApplied: result.promotionId,
        description: result.description,
      });

      grandTotal = grandTotal.add(result.totalPrice);
    }

    return { lineItems, grandTotal };
  }
}
