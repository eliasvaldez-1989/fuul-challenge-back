import type { AppConfig } from './infrastructure/config/config.js';
import type { PriceProvider } from './infrastructure/providers/price.js';
import type { Promotion } from './domain/promotions/promotion.js';

export interface AppDependencies {
  config: AppConfig;
  getProvider: (providerParam?: string) => PriceProvider;
  promotions: readonly Promotion[];
  openSeaAvailable: boolean;
}
