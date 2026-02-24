import { describe, it, expect } from 'vitest';
import { MockPriceProvider } from '../../../src/infrastructure/providers/mock-price.js';
import { Money } from '../../../src/domain/entities/money.js';

describe('MockPriceProvider', () => {
  it('returns default prices when no overrides given', async () => {
    const provider = new MockPriceProvider();
    const snapshot = await provider.getAllPrices();
    expect(snapshot.prices.get('APE')!.toWei()).toBe(Money.fromEth(75n).toWei());
    expect(snapshot.prices.get('PUNK')!.toWei()).toBe(Money.fromEth(60n).toWei());
    expect(snapshot.prices.get('AZUKI')!.toWei()).toBe(Money.fromEth(30n).toWei());
    expect(snapshot.prices.get('MEEBIT')!.toWei()).toBe(Money.fromEth(4n).toWei());
  });

  it('uses overrides when provided', async () => {
    const provider = new MockPriceProvider(
      new Map([
        ['APE', Money.fromEth(1n)],
        ['PUNK', Money.fromEth(2n)],
        ['AZUKI', Money.fromEth(3n)],
        ['MEEBIT', Money.fromEth(4n)],
      ]),
    );
    const snapshot = await provider.getAllPrices();
    expect(snapshot.prices.get('APE')!.toWei()).toBe(Money.fromEth(1n).toWei());
  });

  it('getPrice returns single product price', async () => {
    const provider = new MockPriceProvider();
    const price = await provider.getPrice('APE');
    expect(price.toWei()).toBe(Money.fromEth(75n).toWei());
  });

  it('getPrice throws for unknown product', async () => {
    const provider = new MockPriceProvider(new Map([['APE', Money.fromEth(1n)]]));
    await expect(provider.getPrice('PUNK')).rejects.toThrow('Unknown product');
  });

  it('getAllPrices returns a fresh copy of the map', async () => {
    const provider = new MockPriceProvider();
    const s1 = await provider.getAllPrices();
    const s2 = await provider.getAllPrices();
    expect(s1.prices).not.toBe(s2.prices);
  });

  it('getAllPrices includes fetchedAt date', async () => {
    const provider = new MockPriceProvider();
    const snapshot = await provider.getAllPrices();
    expect(snapshot.fetchedAt).toBeInstanceOf(Date);
  });
});
