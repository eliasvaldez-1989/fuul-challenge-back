import type { Money } from '../../domain/entities/money.js';
import type { ProductCode } from '../../domain/entities/product.js';

export interface PriceSnapshot {
  readonly prices: Map<ProductCode, Money>;
  readonly fetchedAt: Date;
}

export interface PriceProvider {
  getPrice(code: ProductCode): Promise<Money>;
  getAllPrices(): Promise<PriceSnapshot>;
}
