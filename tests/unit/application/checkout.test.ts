import { describe, it, expect, beforeEach } from 'vitest';
import { Checkout } from '../../../src/application/checkout.js';
import { MockPriceProvider } from '../../../src/infrastructure/providers/mock-price.js';
import { BuyXGetYFreePromotion } from '../../../src/domain/promotions/buy-x-get-y-free.js';
import { BulkDiscountPromotion } from '../../../src/domain/promotions/bulk-discount.js';
import { MinStrategy } from '../../../src/domain/strategies/min.js';
import { Money } from '../../../src/domain/entities/money.js';

describe('Checkout', () => {
  const P = {
    APE: Money.fromEth(10n),
    PUNK: Money.fromEth(8n),
    AZUKI: Money.fromEth(5n),
    MEEBIT: Money.fromEth(1n),
  };

  let checkout: Checkout;

  beforeEach(() => {
    const priceProvider = new MockPriceProvider(
      new Map([
        ['APE', P.APE],
        ['PUNK', P.PUNK],
        ['AZUKI', P.AZUKI],
        ['MEEBIT', P.MEEBIT],
      ]),
    );
    const promotions = [
      new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { id: 'buy2get1free', priority: 1 }),
      new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], { id: 'bulk20', priority: 2 }),
    ];
    checkout = new Checkout({
      priceProvider,
      promotions,
      strategy: new MinStrategy(),
    });
  });

  it('empty cart returns zero', async () => {
    const total = await checkout.total();
    expect(total.isZero()).toBe(true);
  });

  it('single item — no promo', async () => {
    checkout.scan('APE');
    const total = await checkout.total();
    expect(total.toWei()).toBe(P.APE.toWei());
  });

  it('scan and remove leaves empty cart', async () => {
    checkout.scan('APE');
    checkout.remove('APE');
    const total = await checkout.total();
    expect(total.isZero()).toBe(true);
  });

  it('remove non-existent product throws', () => {
    expect(() => checkout.remove('APE')).toThrow();
  });

  it('scan rejects invalid product code', () => {
    expect(() => checkout.scan('DOODLE')).toThrow(/Invalid product code/);
  });

  it('remove rejects invalid product code', () => {
    expect(() => checkout.remove('DOODLE')).toThrow(/Invalid product code/);
  });

  it('total throws when price unavailable for a product', async () => {
    const co = new Checkout({
      priceProvider: new MockPriceProvider(new Map([['APE', Money.fromEth(10n)]])),
      promotions: [],
      strategy: new MinStrategy(),
    });
    co.scan('APE');
    // PUNK has no price in this provider — but we can't scan PUNK because
    // the Cart uses ProductCode type. The only way to hit "no price" is if the
    // provider doesn't have the product. We need to scan a valid code that the
    // mock doesn't have a price for.
    // MockPriceProvider only has APE, so PUNK will be missing.
    co.scan('PUNK');
    await expect(co.total()).rejects.toThrow(/No price available/);
  });

  describe('challenge scenarios (dynamic prices)', () => {
    it('APE, PUNK, MEEBIT → A + P + M', async () => {
      checkout.scan('APE');
      checkout.scan('PUNK');
      checkout.scan('MEEBIT');
      const total = await checkout.total();
      const expected = P.APE.add(P.PUNK).add(P.MEEBIT);
      expect(total.toWei()).toBe(expected.toWei());
    });

    it('APE, PUNK, APE → 2A + P (no promo with only 2 APE)', async () => {
      checkout.scan('APE');
      checkout.scan('PUNK');
      checkout.scan('APE');
      const total = await checkout.total();
      const expected = P.APE.multiply(2n).add(P.PUNK);
      expect(total.toWei()).toBe(expected.toWei());
    });

    it('PUNK×3, APE, PUNK → 4×(P×0.8) + A', async () => {
      checkout.scan('PUNK');
      checkout.scan('PUNK');
      checkout.scan('PUNK');
      checkout.scan('APE');
      checkout.scan('PUNK');
      const total = await checkout.total();
      const punkBulk = P.PUNK.applyPercentage(80n).multiply(4n);
      const expected = punkBulk.add(P.APE);
      expect(total.toWei()).toBe(expected.toWei());
    });

    it('APE×3, PUNK×2, MEEBIT, PUNK → 2A + 3×(P×0.8) + M', async () => {
      checkout.scan('APE');
      checkout.scan('PUNK');
      checkout.scan('APE');
      checkout.scan('APE');
      checkout.scan('MEEBIT');
      checkout.scan('PUNK');
      checkout.scan('PUNK');
      const total = await checkout.total();
      const apeB2G1F = P.APE.multiply(2n); // B2G1F: pay for 2
      const punkBulk = P.PUNK.applyPercentage(80n).multiply(3n); // Bulk
      const expected = apeB2G1F.add(punkBulk).add(P.MEEBIT);
      expect(total.toWei()).toBe(expected.toWei());
    });

    it('AZUKI×3 → min(2Z, 3×(Z×0.8))', async () => {
      checkout.scan('AZUKI');
      checkout.scan('AZUKI');
      checkout.scan('AZUKI');
      const total = await checkout.total();
      const b2g1f = P.AZUKI.multiply(2n);
      const bulk = P.AZUKI.applyPercentage(80n).multiply(3n);
      const expected = Money.min(b2g1f, bulk);
      expect(total.toWei()).toBe(expected.toWei());
    });
  });

  it('items scanned in any order produce same total', async () => {
    // Order 1: APE, PUNK, APE, APE, MEEBIT, PUNK, PUNK
    const co1 = new Checkout({
      priceProvider: new MockPriceProvider(
        new Map([['APE', P.APE], ['PUNK', P.PUNK], ['AZUKI', P.AZUKI], ['MEEBIT', P.MEEBIT]]),
      ),
      promotions: [
        new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { id: 'buy2get1free', priority: 1 }),
        new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], { id: 'bulk20', priority: 2 }),
      ],
      strategy: new MinStrategy(),
    });
    co1.scan('APE'); co1.scan('PUNK'); co1.scan('APE');
    co1.scan('APE'); co1.scan('MEEBIT'); co1.scan('PUNK'); co1.scan('PUNK');

    // Order 2: MEEBIT, PUNK, PUNK, PUNK, APE, APE, APE
    const co2 = new Checkout({
      priceProvider: new MockPriceProvider(
        new Map([['APE', P.APE], ['PUNK', P.PUNK], ['AZUKI', P.AZUKI], ['MEEBIT', P.MEEBIT]]),
      ),
      promotions: [
        new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], { id: 'buy2get1free', priority: 1 }),
        new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], { id: 'bulk20', priority: 2 }),
      ],
      strategy: new MinStrategy(),
    });
    co2.scan('MEEBIT'); co2.scan('PUNK'); co2.scan('PUNK');
    co2.scan('PUNK'); co2.scan('APE'); co2.scan('APE'); co2.scan('APE');

    const total1 = await co1.total();
    const total2 = await co2.total();
    expect(total1.toWei()).toBe(total2.toWei());
  });
});
