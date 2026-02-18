export interface CheckoutRequestItem {
  readonly productCode: string;
  readonly quantity: number;
}

export interface CheckoutRequest {
  readonly items: readonly CheckoutRequestItem[];
}
