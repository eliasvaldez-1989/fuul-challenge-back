export interface CheckoutResponseLineItem {
  readonly productCode: string;
  readonly quantity: number;
  readonly unitPriceWei: string;
  readonly totalPriceWei: string;
  readonly unitPriceEth: string;
  readonly totalPriceEth: string;
  readonly promotionApplied: string;
  readonly description: string;
}

export interface CheckoutResponse {
  readonly lineItems: readonly CheckoutResponseLineItem[];
  readonly grandTotalWei: string;
  readonly grandTotalEth: string;
  readonly strategyUsed: string;
  readonly pricesFetchedAt: string;
  readonly priceValidUntil: string;
}
