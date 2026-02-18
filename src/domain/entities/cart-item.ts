import type { Money } from './money.js';
import type { ProductCode } from './product.js';

export interface CartItem {
  readonly productCode: ProductCode;
  readonly unitPrice: Money;
  readonly quantity: number;
}
