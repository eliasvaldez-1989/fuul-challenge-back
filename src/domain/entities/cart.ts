import type { ProductCode } from './product.js';

const MAX_QUANTITY_PER_PRODUCT = 10_000;

export class Cart {
  private quantities = new Map<ProductCode, number>();

  scan(productCode: ProductCode): void {
    const current = this.quantities.get(productCode) ?? 0;
    if (current >= MAX_QUANTITY_PER_PRODUCT) {
      throw new CartError(
        `Cannot add more of ${productCode} (max ${MAX_QUANTITY_PER_PRODUCT})`,
      );
    }
    this.quantities.set(productCode, current + 1);
  }

  remove(productCode: ProductCode): void {
    const current = this.quantities.get(productCode);
    if (!current || current === 0) {
      throw new CartError(`Product ${productCode} not in cart`);
    }
    if (current === 1) {
      this.quantities.delete(productCode);
    } else {
      this.quantities.set(productCode, current - 1);
    }
  }

  getQuantities(): ReadonlyMap<ProductCode, number> {
    return this.quantities;
  }

  isEmpty(): boolean {
    return this.quantities.size === 0;
  }

  clear(): void {
    this.quantities.clear();
  }
}

export class CartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CartError';
  }
}
