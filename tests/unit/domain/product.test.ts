import { describe, it, expect } from 'vitest';
import { isProductCode, ALL_PRODUCT_CODES, PRODUCT_SLUGS, PRODUCT_NAMES } from '../../../src/domain/entities/product.js';

describe('Product', () => {
  it('isProductCode accepts valid codes', () => {
    expect(isProductCode('APE')).toBe(true);
    expect(isProductCode('PUNK')).toBe(true);
    expect(isProductCode('AZUKI')).toBe(true);
    expect(isProductCode('MEEBIT')).toBe(true);
  });

  it('isProductCode rejects invalid values', () => {
    expect(isProductCode('DOODLE')).toBe(false);
    expect(isProductCode('')).toBe(false);
    expect(isProductCode(123)).toBe(false);
    expect(isProductCode(null)).toBe(false);
  });

  it('ALL_PRODUCT_CODES contains all 4 products', () => {
    expect(ALL_PRODUCT_CODES).toEqual(['APE', 'PUNK', 'AZUKI', 'MEEBIT']);
  });

  it('every product has a slug and name', () => {
    for (const code of ALL_PRODUCT_CODES) {
      expect(PRODUCT_SLUGS[code]).toBeDefined();
      expect(PRODUCT_NAMES[code]).toBeDefined();
    }
  });
});
