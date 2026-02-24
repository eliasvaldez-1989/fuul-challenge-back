import type { CheckoutRequest } from '../dto/checkout-request.js';
import type { CheckoutResponse } from '../dto/checkout-response.js';
import type { PriceProvider } from '../../infrastructure/providers/price.js';
import { type ProductCode, isProductCode } from '../../domain/entities/product.js';
import type { CartItem } from '../../domain/entities/cart-item.js';
import { PricingEngine } from '../../domain/engines/pricing.js';
import type { Promotion } from '../../domain/promotions/promotion.js';
import type { PromotionStrategy } from '../../domain/strategies/promotion.js';

const MAX_ITEMS = 50;
const MAX_QUANTITY_PER_ITEM = 1000;
const QUOTE_VALIDITY_MS = 30_000;

export class CheckoutService {
  constructor(
    private readonly priceProvider: PriceProvider,
    private readonly promotions: readonly Promotion[],
    private readonly strategy: PromotionStrategy,
  ) {}

  async calculateCheckout(input: CheckoutRequest): Promise<CheckoutResponse> {
    this.validateRequest(input);

    const snapshot = await this.priceProvider.getAllPrices();

    const cartItems: CartItem[] = input.items.map((reqItem) => {
      const code = reqItem.productCode as ProductCode;
      const price = snapshot.prices.get(code);
      if (!price) {
        throw new CheckoutError(`Price unavailable for product: ${code}`);
      }
      return { productCode: code, unitPrice: price, quantity: reqItem.quantity };
    });

    const engine = new PricingEngine(this.promotions, this.strategy);
    const result = engine.calculate(cartItems);

    const validUntil = new Date(snapshot.fetchedAt.getTime() + QUOTE_VALIDITY_MS);

    return {
      lineItems: result.lineItems.map((li) => ({
        productCode: li.productCode,
        quantity: li.quantity,
        unitPriceWei: li.unitPrice.toWei().toString(),
        totalPriceWei: li.totalPrice.toWei().toString(),
        unitPriceEth: li.unitPrice.toEthString(),
        totalPriceEth: li.totalPrice.toEthString(),
        promotionApplied: li.promotionApplied,
        description: li.description,
      })),
      grandTotalWei: result.grandTotal.toWei().toString(),
      grandTotalEth: result.grandTotal.toEthString(),
      strategyUsed: this.strategy.name,
      pricesFetchedAt: snapshot.fetchedAt.toISOString(),
      priceValidUntil: validUntil.toISOString(),
    };
  }

  private validateRequest(input: CheckoutRequest): void {
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new CheckoutError('Cart is empty');
    }
    if (input.items.length > MAX_ITEMS) {
      throw new CheckoutError(`Too many items (max ${MAX_ITEMS})`);
    }
    for (const item of input.items) {
      if (!item.productCode || typeof item.productCode !== 'string') {
        throw new CheckoutError('Invalid product code');
      }
      if (!isProductCode(item.productCode)) {
        throw new CheckoutError(`Unknown product: ${item.productCode}`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new CheckoutError(
          `Invalid quantity for ${item.productCode}: ${item.quantity}`,
        );
      }
      if (item.quantity > MAX_QUANTITY_PER_ITEM) {
        throw new CheckoutError(
          `Quantity too large for ${item.productCode} (max ${MAX_QUANTITY_PER_ITEM})`,
        );
      }
    }
  }
}

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutError';
  }
}
