import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { loadConfig } from './infrastructure/config/config.js';
import { logger } from './infrastructure/logger/logger.js';
import { MockPriceProvider } from './infrastructure/providers/mock-price.js';
import { OpenSeaPriceProvider } from './infrastructure/providers/opensea-price.js';
import { BuyXGetYFreePromotion } from './domain/promotions/buy-x-get-y-free.js';
import { BulkDiscountPromotion } from './domain/promotions/bulk-discount.js';
import type { PriceProvider } from './infrastructure/providers/price.js';
import type { AppDependencies } from './types.js';
import { requestId } from './middlewares/request-id.js';
import { requestLogger } from './middlewares/request-logger.js';
import { healthRouter } from './routes/health.js';
import { pricesRouter } from './routes/prices.js';
import { checkoutRouter } from './routes/checkout.js';
import { metricsRouter, trackRequest, trackError } from './routes/metrics.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestId);
app.use(requestLogger);
app.use((_req, _res, next) => {
  trackRequest();
  next();
});

app.use(
  '/api/',
  rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  }),
);

const mockProvider = new MockPriceProvider();
const openSeaProvider: PriceProvider | null = config.openSeaApiKey
  ? new OpenSeaPriceProvider(config.openSeaApiKey, config.priceCacheTtlMs)
  : null;

function getProvider(providerParam?: string): PriceProvider {
  if (providerParam === 'opensea') {
    if (!openSeaProvider) {
      throw new ProviderConfigurationError(
        'OpenSea provider not available — set OPENSEA_API_KEY',
      );
    }
    return openSeaProvider;
  }
  return mockProvider;
}

const promotions = [
  new BuyXGetYFreePromotion(2, 1, ['APE', 'AZUKI'], {
    id: 'buy2get1free',
    name: 'Buy 2 Get 1 Free',
    priority: 1,
  }),
  new BulkDiscountPromotion(3, 20, ['PUNK', 'AZUKI'], {
    id: 'bulk20',
    name: '20% Bulk Discount (3+)',
    priority: 2,
  }),
];

const deps: AppDependencies = {
  config,
  getProvider,
  promotions,
  openSeaAvailable: !!openSeaProvider,
};

app.use('/api/health', healthRouter(deps));
app.use('/api/prices', pricesRouter(deps));
app.use('/api/checkout', checkoutRouter(deps));
app.use('/api/metrics', metricsRouter());

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    trackError();
    logger.error({ err }, 'Unhandled error');

    if (err instanceof ProviderConfigurationError) {
      return res.status(503).json({ error: 'Price provider unavailable' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  },
);

const PORT = Number(process.env.PORT ?? 3001);
if (Number.isNaN(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error('Invalid PORT environment variable');
}

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, openSea: !!openSeaProvider, strategy: config.promotionStrategy }, 'Server started');
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down...');

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(() => {
    logger.info('HTTP server closed');
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigurationError';
  }
}
