import 'dotenv/config';
import type { StrategyType } from '../../domain/strategies/factory.js';

export interface AppConfig {
  readonly nodeEnv: string;
  readonly openSeaApiKey: string;
  readonly priceCacheTtlMs: number;
  readonly promotionStrategy: StrategyType;
}

export function loadConfig(): AppConfig {
  const strategy = (process.env.PROMOTION_STRATEGY ?? 'MIN').toUpperCase();
  if (!['MIN', 'PRIORITY', 'STACK'].includes(strategy)) {
    throw new Error(
      `Invalid PROMOTION_STRATEGY: "${strategy}". Must be MIN, PRIORITY, or STACK.`,
    );
  }

  const cacheTtl = parseInt(process.env.PRICE_CACHE_TTL_MS ?? '60000', 10);
  if (Number.isNaN(cacheTtl) || cacheTtl < 0) {
    throw new Error(`Invalid PRICE_CACHE_TTL_MS: "${process.env.PRICE_CACHE_TTL_MS}"`);
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    openSeaApiKey: process.env.OPENSEA_API_KEY ?? '',
    priceCacheTtlMs: cacheTtl,
    promotionStrategy: strategy as StrategyType,
  };
}
