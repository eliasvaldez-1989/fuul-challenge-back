import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenSeaPriceProvider, PriceProviderError } from '../../../src/infrastructure/providers/opensea-price.js';
import { Money } from '../../../src/domain/entities/money.js';

function mockBody(overrides: Record<string, unknown> = {}) {
  return {
    total: {
      floor_price: 5.5,
      floor_price_symbol: 'ETH',
      ...overrides,
    },
  };
}

function stubFetchOk(body = mockBody()) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
}

function stubFetchStatus(status: number, headers: Record<string, string> = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response('{}', { status, headers }),
  );
}

describe('OpenSeaPriceProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createProvider(cacheTtl = 60_000) {
    return new OpenSeaPriceProvider('test-key', cacheTtl, 1_000, 0);
  }

  it('fetches all 4 products and returns prices', async () => {
    stubFetchOk();
    const provider = createProvider();
    const snapshot = await provider.getAllPrices();
    expect(snapshot.prices.size).toBe(4);
    expect(snapshot.fetchedAt).toBeInstanceOf(Date);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('sends correct headers', async () => {
    stubFetchOk();
    const provider = createProvider();
    await provider.getAllPrices();
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toContain('api.opensea.io');
    expect((call[1]?.headers as Record<string, string>)['X-Api-Key']).toBe('test-key');
  });

  it('caches results within TTL', async () => {
    stubFetchOk();
    const provider = createProvider(60_000);
    await provider.getAllPrices();
    await provider.getAllPrices();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('getPrice delegates to getAllPrices', async () => {
    stubFetchOk();
    const provider = createProvider();
    const price = await provider.getPrice('APE');
    expect(price.toWei()).toBe(Money.fromEthDecimal('5.5').toWei());
  });

  it('getPrice throws for missing product after partial failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('boredapeyachtclub')) {
        return new Response(JSON.stringify(mockBody()), { status: 200 });
      }
      throw new Error('network error');
    });
    const provider = new OpenSeaPriceProvider('key', 60_000, 1_000, 0);
    const snapshot = await provider.getAllPrices();
    expect(snapshot.prices.has('APE')).toBe(true);
    await expect(provider.getPrice('MEEBIT')).rejects.toThrow(PriceProviderError);
  });

  it('handles HTTP 500 responses', async () => {
    stubFetchStatus(500);
    const provider = createProvider();
    await expect(provider.getAllPrices()).rejects.toThrow(PriceProviderError);
  });

  it('handles 429 rate limit', async () => {
    stubFetchStatus(429, { 'Retry-After': '5' });
    const provider = createProvider();
    await expect(provider.getAllPrices()).rejects.toThrow(/rate limited|All price fetches failed/i);
  });

  it('validates response structure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ invalid: true }), { status: 200 }),
    );
    const provider = createProvider();
    await expect(provider.getAllPrices()).rejects.toThrow(PriceProviderError);
  });

  it('validates floor_price_symbol is ETH', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ total: { floor_price: 5.0, floor_price_symbol: 'WETH' } }), { status: 200 }),
    );
    const provider = createProvider();
    await expect(provider.getAllPrices()).rejects.toThrow(/symbol/i);
  });

  it('validates floor_price is a number', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ total: { floor_price: null, floor_price_symbol: 'ETH' } }), { status: 200 }),
    );
    const provider = createProvider();
    await expect(provider.getAllPrices()).rejects.toThrow(PriceProviderError);
  });

  it('returns stale cache when all fetches fail', async () => {
    stubFetchOk();
    const provider = new OpenSeaPriceProvider('key', 1, 1_000, 0);
    await provider.getAllPrices();
    await new Promise((r) => setTimeout(r, 10));

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('network down'); });

    const snapshot = await provider.getAllPrices();
    expect(snapshot.prices.size).toBe(4);
  });

  it('merges partial failures with cached data', async () => {
    stubFetchOk();
    const provider = new OpenSeaPriceProvider('key', 1, 1_000, 0);
    await provider.getAllPrices();
    await new Promise((r) => setTimeout(r, 10));

    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return new Response(JSON.stringify(mockBody({ floor_price: 99.0 })), { status: 200 });
      }
      throw new Error('partial fail');
    });

    const snapshot = await provider.getAllPrices();
    expect(snapshot.prices.size).toBe(4);
  });

  it('deduplicates concurrent requests', async () => {
    let resolveGate: () => void;
    const gate = new Promise<void>((r) => { resolveGate = r; });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await gate;
      return new Response(JSON.stringify(mockBody()), { status: 200 });
    });

    const provider = createProvider();
    const p1 = provider.getAllPrices();
    const p2 = provider.getAllPrices();

    resolveGate!();
    const [s1, s2] = await Promise.all([p1, p2]);

    expect(s1.prices.size).toBe(4);
    expect(s2.prices.size).toBe(4);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('retries with delay on failure', async () => {
    let attempts = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++;
      if (attempts <= 4) throw new Error('transient');
      return new Response(JSON.stringify(mockBody()), { status: 200 });
    });
    // maxRetries=1 so fetchWithRetry will try twice per slug (attempt 0 + retry 1)
    const provider = new OpenSeaPriceProvider('key', 60_000, 1_000, 1);
    // With 4 slugs × 2 attempts = 8 calls, some will fail and some succeed
    const snapshot = await provider.getAllPrices();
    expect(snapshot.prices.size).toBeGreaterThan(0);
    expect(attempts).toBeGreaterThan(4);
  });

  it('handles 429 without Retry-After header', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response('{}', { status: 429 }),
    );
    const provider = createProvider();
    await expect(provider.getAllPrices()).rejects.toThrow();
  });

  describe('circuit breaker', () => {
    it('opens after 5 consecutive total failures', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('fail'); });
      const provider = new OpenSeaPriceProvider('key', 1, 1_000, 0);

      for (let i = 0; i < 5; i++) {
        try { await provider.getAllPrices(); } catch { /* expected */ }
      }

      await expect(provider.getAllPrices()).rejects.toThrow(/circuit breaker/i);
    });

    it('returns stale cache when circuit is open', async () => {
      stubFetchOk();
      const provider = new OpenSeaPriceProvider('key', 1, 1_000, 0);
      await provider.getAllPrices();
      await new Promise((r) => setTimeout(r, 10));

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('fail'); });

      // 5 failures open the circuit; each returns stale cache via all-fetches-failed path
      for (let i = 0; i < 5; i++) {
        const snapshot = await provider.getAllPrices();
        expect(snapshot.prices.size).toBe(4);
      }
      // 6th call: circuit open, canExecute() → false → returns stale cache directly
      const snapshot = await provider.getAllPrices();
      expect(snapshot.prices.size).toBe(4);
    });

    it('recovers after reset timeout', async () => {
      vi.useFakeTimers();
      try {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('fail'); });
        const provider = new OpenSeaPriceProvider('key', 1, 1_000, 0);

        for (let i = 0; i < 5; i++) {
          try { await provider.getAllPrices(); } catch { /* expected */ }
        }

        await expect(provider.getAllPrices()).rejects.toThrow(/circuit breaker/i);

        vi.advanceTimersByTime(31_000);

        vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
          new Response(JSON.stringify(mockBody()), { status: 200 }),
        );

        const snapshot = await provider.getAllPrices();
        expect(snapshot.prices.size).toBe(4);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
