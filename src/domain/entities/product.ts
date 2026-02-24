export type ProductCode = 'APE' | 'PUNK' | 'AZUKI' | 'MEEBIT';

export const PRODUCT_SLUGS: Record<ProductCode, string> = {
  APE: 'boredapeyachtclub',
  PUNK: 'cryptopunks',
  AZUKI: 'azuki',
  MEEBIT: 'meebits',
};

export const PRODUCT_NAMES: Record<ProductCode, string> = {
  APE: 'Bored Apes',
  PUNK: 'Crypto Punks',
  AZUKI: 'Azuki',
  MEEBIT: 'Meebits',
};

export const ALL_PRODUCT_CODES: readonly ProductCode[] = ['APE', 'PUNK', 'AZUKI', 'MEEBIT'];

export function isProductCode(value: unknown): value is ProductCode {
  return typeof value === 'string' && ALL_PRODUCT_CODES.includes(value as ProductCode);
}
