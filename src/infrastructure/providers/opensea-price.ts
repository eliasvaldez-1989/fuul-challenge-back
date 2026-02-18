import { Money } from '../../domain/entities/money.js';
import { type ProductCode, PRODUCT_SLUGS, ALL_PRODUCT_CODES } from '../../domain/entities/product.js';
import type { PriceProvider, PriceSnapshot } from './price.js';
import { logger } from '../logger/logger.js';

const EXPECTED_SYMBOL = 'ETH';
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;

class CircuitBreaker {
  private failures = 0;
  private lastFailureAt = 0;
  private open = false;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 30_000,
  ) {}

  canExecute(): boolean {
    if (!this.open) return true;
    if (Date.now() - this.lastFailureAt >= this.resetTimeoutMs) {
      return true; // allow probe after timeout
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.open = false;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureAt = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.open = true;
    }
  }
}

interface CacheEntry {
  prices: Map<ProductCode, Money>;
  expiresAt: number;
  fetchedAt: number;
}

export class OpenSeaPriceProvider implements PriceProvider {
  private static readonly BASE_URL = 'https://api.opensea.io/api/v2';

  private cache: CacheEntry | null = null;
  private inflightRequest: Promise<PriceSnapshot> | null = null;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly apiKey: string,
    private readonly cacheTtlMs: number = 60_000,
    private readonly fetchTimeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
    private readonly maxRetries: number = DEFAULT_MAX_RETRIES,
  ) {
    this.circuitBreaker = new CircuitBreaker();
  }

  async getPrice(code: ProductCode): Promise<Money> {
    const snapshot = await this.getAllPrices();
    const price = snapshot.prices.get(code);
    if (!price) {
      throw new PriceProviderError(`No price found for product: ${code}`);
    }
    return price;
  }

  async getAllPrices(): Promise<PriceSnapshot> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return { prices: new Map(this.cache.prices), fetchedAt: new Date(this.cache.fetchedAt) };
    }

    if (this.inflightRequest) {
      return this.inflightRequest;
    }

    this.inflightRequest = this.fetchAllPrices();
    try {
      return await this.inflightRequest;
    } finally {
      this.inflightRequest = null;
    }
  }

  private async fetchAllPrices(): Promise<PriceSnapshot> {
    if (!this.circuitBreaker.canExecute()) {
      if (this.cache) {
        logger.warn('Circuit breaker open, returning stale cache');
        return { prices: new Map(this.cache.prices), fetchedAt: new Date(this.cache.fetchedAt) };
      }
      throw new PriceProviderError('OpenSea circuit breaker is open and no cached prices available');
    }

    const results = await Promise.allSettled(
      ALL_PRODUCT_CODES.map(async (code) => {
        const slug = PRODUCT_SLUGS[code];
        const price = await this.fetchWithRetry(slug);
        return { code, price };
      }),
    );

    const prices = new Map<ProductCode, Money>();
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        prices.set(result.value.code, result.value.price);
      } else {
        errors.push(String(result.reason));
      }
    }

    if (prices.size === 0) {
      this.circuitBreaker.recordFailure();
      if (this.cache) {
        logger.warn({ errors }, 'All fetches failed, returning stale cache');
        return { prices: new Map(this.cache.prices), fetchedAt: new Date(this.cache.fetchedAt) };
      }
      throw new PriceProviderError(
        `All price fetches failed: ${errors.join('; ')}`,
      );
    }

    if (errors.length > 0 && this.cache) {
      logger.warn(
        { errorCount: errors.length, successCount: prices.size },
        'Partial fetch failure, merging with cached prices',
      );
      for (const code of ALL_PRODUCT_CODES) {
        if (!prices.has(code) && this.cache.prices.has(code)) {
          prices.set(code, this.cache.prices.get(code)!);
        }
      }
    } else if (errors.length > 0) {
      logger.warn(
        { errorCount: errors.length, successCount: prices.size },
        'Partial fetch failure, no cache to merge',
      );
    }

    const now = Date.now();
    this.circuitBreaker.recordSuccess();
    this.cache = {
      prices,
      expiresAt: now + this.cacheTtlMs,
      fetchedAt: now,
    };

    return { prices: new Map(prices), fetchedAt: new Date(now) };
  }

  private async fetchWithRetry(slug: string): Promise<Money> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.fetchFloorPrice(slug);
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = DEFAULT_RETRY_BASE_MS * 2 ** attempt;
          logger.debug({ slug, attempt, delay }, 'Retrying OpenSea fetch');
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private async fetchFloorPrice(slug: string): Promise<Money> {
    const url = `${OpenSeaPriceProvider.BASE_URL}/collections/${slug}/stats`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': this.apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(this.fetchTimeoutMs),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : 2_000;
      throw new PriceProviderError(
        `OpenSea rate limited for ${slug}, retry after ${waitMs}ms`,
      );
    }

    if (!response.ok) {
      throw new PriceProviderError(
        `OpenSea API error for ${slug}: HTTP ${response.status}`,
      );
    }

    const data: unknown = await response.json();
    const validated = this.validateResponse(data, slug);

    return Money.fromEthDecimal(validated.floor_price.toString());
  }

  private validateResponse(
    data: unknown,
    slug: string,
  ): { floor_price: number; floor_price_symbol: string } {
    if (
      !data ||
      typeof data !== 'object' ||
      !('total' in data) ||
      !data.total ||
      typeof data.total !== 'object'
    ) {
      throw new PriceProviderError(
        `Invalid OpenSea response structure for ${slug}`,
      );
    }

    const total = data.total as Record<string, unknown>;
    const floorPrice = total.floor_price;
    const symbol = total.floor_price_symbol;

    if (floorPrice === null || floorPrice === undefined || typeof floorPrice !== 'number') {
      throw new PriceProviderError(
        `No floor price available for ${slug}`,
      );
    }

    if (typeof symbol !== 'string' || symbol !== EXPECTED_SYMBOL) {
      throw new PriceProviderError(
        `Unexpected price symbol for ${slug}: "${symbol}" (expected "${EXPECTED_SYMBOL}")`,
      );
    }

    return { floor_price: floorPrice, floor_price_symbol: symbol };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class PriceProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceProviderError';
  }
}
