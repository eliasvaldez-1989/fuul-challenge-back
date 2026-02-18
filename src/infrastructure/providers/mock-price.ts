import { Money } from '../../domain/entities/money.js';
import type { ProductCode } from '../../domain/entities/product.js';
import type { PriceProvider, PriceSnapshot } from './price.js';

export class MockPriceProvider implements PriceProvider {
  private readonly prices: Map<ProductCode, Money>;

  constructor(priceOverrides?: Map<ProductCode, Money>) {
    this.prices =
      priceOverrides ??
      new Map<ProductCode, Money>([
        ['APE', Money.fromEth(75n)],
        ['PUNK', Money.fromEth(60n)],
        ['AZUKI', Money.fromEth(30n)],
        ['MEEBIT', Money.fromEth(4n)],
      ]);
  }

  async getPrice(code: ProductCode): Promise<Money> {
    const price = this.prices.get(code);
    if (!price) throw new Error(`Unknown product: ${code}`);
    return price;
  }

  async getAllPrices(): Promise<PriceSnapshot> {
    return {
      prices: new Map(this.prices),
      fetchedAt: new Date(),
    };
  }
}
