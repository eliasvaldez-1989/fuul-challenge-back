import { Cart } from '../domain/entities/cart.js';
import { PricingEngine } from '../domain/engines/pricing.js';
import type { Promotion } from '../domain/promotions/promotion.js';
import type { PromotionStrategy } from '../domain/strategies/promotion.js';
import { Money } from '../domain/entities/money.js';
import type { PriceProvider } from '../infrastructure/providers/price.js';
import { isProductCode } from '../domain/entities/product.js';
import type { CartItem } from '../domain/entities/cart-item.js';

export interface PricingRules {
  readonly priceProvider: PriceProvider;
  readonly promotions: readonly Promotion[];
  readonly strategy: PromotionStrategy;
}

export class Checkout {
  private readonly cart = new Cart();

  constructor(private readonly rules: PricingRules) {}

  scan(productCode: string): void {
    if (!isProductCode(productCode)) {
      throw new Error(`Invalid product code: ${productCode}`);
    }
    this.cart.scan(productCode);
  }

  remove(productCode: string): void {
    if (!isProductCode(productCode)) {
      throw new Error(`Invalid product code: ${productCode}`);
    }
    this.cart.remove(productCode);
  }

  async total(): Promise<Money> {
    if (this.cart.isEmpty()) {
      return Money.zero();
    }

    const snapshot = await this.rules.priceProvider.getAllPrices();

    const items: CartItem[] = [];
    for (const [code, quantity] of this.cart.getQuantities()) {
      const unitPrice = snapshot.prices.get(code);
      if (!unitPrice) {
        throw new Error(`No price available for product: ${code}`);
      }
      items.push({ productCode: code, unitPrice, quantity });
    }

    const engine = new PricingEngine(this.rules.promotions, this.rules.strategy);
    const result = engine.calculate(items);
    return result.grandTotal;
  }
}
