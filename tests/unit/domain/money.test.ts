import { describe, it, expect } from 'vitest';
import { Money, MoneyError } from '../../../src/domain/entities/money.js';

describe('Money', () => {
  describe('creation', () => {
    it('creates zero', () => {
      expect(Money.zero().toWei()).toBe(0n);
    });

    it('creates from wei', () => {
      const m = Money.fromWei(1000n);
      expect(m.toWei()).toBe(1000n);
    });

    it('creates from whole ETH', () => {
      const m = Money.fromEth(75n);
      expect(m.toWei()).toBe(75n * 10n ** 18n);
    });

    it('creates from decimal ETH string', () => {
      const m = Money.fromEthDecimal('5.899');
      expect(m.toWei()).toBe(5_899000000000000000n);
    });

    it('creates from decimal ETH string with many decimals', () => {
      const m = Money.fromEthDecimal('0.431699999900000');
      expect(m.toWei()).toBe(431699999900000000n);
    });

    it('creates from whole ETH string via fromEthDecimal', () => {
      const m = Money.fromEthDecimal('10');
      expect(m.toWei()).toBe(10n * 10n ** 18n);
    });

    it('throws on negative wei', () => {
      expect(() => Money.fromWei(-1n)).toThrow(MoneyError);
    });

    it('throws on invalid ETH decimal string', () => {
      expect(() => Money.fromEthDecimal('')).toThrow(MoneyError);
      expect(() => Money.fromEthDecimal('abc')).toThrow(MoneyError);
      expect(() => Money.fromEthDecimal('-5')).toThrow(MoneyError);
    });
  });

  describe('arithmetic', () => {
    const a = Money.fromEth(10n);
    const b = Money.fromEth(3n);

    it('adds correctly', () => {
      expect(a.add(b).toWei()).toBe(13n * 10n ** 18n);
    });

    it('subtracts correctly', () => {
      expect(a.subtract(b).toWei()).toBe(7n * 10n ** 18n);
    });

    it('throws when subtraction would be negative', () => {
      expect(() => b.subtract(a)).toThrow(MoneyError);
    });

    it('multiplies correctly', () => {
      expect(b.multiply(4n).toWei()).toBe(12n * 10n ** 18n);
    });

    it('applies percentage (80% = 20% discount)', () => {
      const discounted = Money.fromEth(60n).applyPercentage(80n);
      expect(discounted.toWei()).toBe(48n * 10n ** 18n);
    });

    it('applies 0% percentage', () => {
      expect(a.applyPercentage(0n).toWei()).toBe(0n);
    });

    it('applies 100% percentage (no discount)', () => {
      expect(a.applyPercentage(100n).toWei()).toBe(a.toWei());
    });

    it('throws on percentage > 100', () => {
      expect(() => a.applyPercentage(101n)).toThrow(MoneyError);
    });

    it('throws on negative percentage', () => {
      expect(() => a.applyPercentage(-1n)).toThrow(MoneyError);
    });
  });

  describe('comparison', () => {
    const a = Money.fromEth(10n);
    const b = Money.fromEth(5n);

    it('isGreaterThan', () => {
      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isGreaterThan(a)).toBe(false);
    });

    it('isLessThan', () => {
      expect(b.isLessThan(a)).toBe(true);
      expect(a.isLessThan(b)).toBe(false);
    });

    it('isEqual', () => {
      expect(a.isEqual(Money.fromEth(10n))).toBe(true);
      expect(a.isEqual(b)).toBe(false);
    });

    it('isZero', () => {
      expect(Money.zero().isZero()).toBe(true);
      expect(a.isZero()).toBe(false);
    });

    it('min picks smaller', () => {
      expect(Money.min(a, b).toWei()).toBe(b.toWei());
      expect(Money.min(b, a).toWei()).toBe(b.toWei());
    });
  });

  describe('formatting', () => {
    it('formats whole ETH', () => {
      expect(Money.fromEth(75n).toEthString()).toBe('75 ETH');
    });

    it('formats fractional ETH', () => {
      const m = Money.fromEthDecimal('5.899');
      expect(m.toEthString()).toBe('5.899 ETH');
    });

    it('formats zero', () => {
      expect(Money.zero().toEthString()).toBe('0 ETH');
    });

    it('toString delegates to toEthString', () => {
      expect(Money.fromEth(10n).toString()).toBe('10 ETH');
    });
  });
});
