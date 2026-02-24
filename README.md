# Fuul Backend Code Challenge

Checkout system for an NFT marketplace. Calculates cart totals with real-time floor prices from OpenSea and configurable promotional discounts.

https://www.loom.com/share/96b9e278ca1f45889618660d61889943


## Quick Start

```bash
npm install
npm test
npm run dev                           # port 3001, hot reload
OPENSEA_API_KEY=xxx npm run dev
PROMOTION_STRATEGY=STACK npm run dev
```

Node.js >= 20.

## Architecture

```
src/
  domain/
    entities/          Money (BigInt wei), Cart, Product, CartItem
    promotions/        BuyXGetYFree, BulkDiscount
    strategies/        Min, Priority, Stack + factory
    engines/           PricingEngine
  application/
    checkout.ts        scan/remove/total
    services/          CheckoutService
    dto/
  infrastructure/
    providers/         OpenSeaPriceProvider, MockPriceProvider
    config/
    logger/
  routes/
  middlewares/
  server.ts
```

Domain → Application → Infrastructure. No reverse imports.

## HTTP API

### `GET /api/health`

```json
{ "status": "ok", "openSeaAvailable": true, "defaultStrategy": "MIN", "timestamp": "..." }
```

Liveness probe: `GET /api/health/live`.

### `GET /api/prices?provider=mock|opensea`

```json
{
  "products": [
    { "code": "APE", "name": "Bored Apes", "priceWei": "...", "priceEth": "75.0 ETH", "promotions": ["Buy 2 Get 1 Free"] }
  ],
  "provider": "mock",
  "fetchedAt": "..."
}
```

### `POST /api/checkout`

```json
{
  "items": [{ "productCode": "APE", "quantity": 3 }],
  "provider": "mock",
  "strategy": "MIN"
}
```

```json
{
  "lineItems": [{
    "productCode": "APE", "quantity": 3,
    "unitPriceWei": "...", "unitPriceEth": "75.0 ETH",
    "totalPriceWei": "...", "totalPriceEth": "150.0 ETH",
    "promotionApplied": "buy2get1free",
    "description": "Buy 2 Get 1 Free: pay for 2 of 3"
  }],
  "grandTotalWei": "...",
  "grandTotalEth": "150.0 ETH",
  "strategyUsed": "MIN",
  "pricesFetchedAt": "...",
  "priceValidUntil": "..."
}
```

Responses include a 30s price quote (`priceValidUntil`).

### `GET /api/metrics`

```json
{ "uptime_seconds": 120, "requests_total": 45, "errors_total": 0, "memory": { "rss_mb": 52, "heap_used_mb": 18, "heap_total_mb": 32 } }
```

## Design Decisions

**Money as BigInt (Wei):** All calculations in wei (1 ETH = 10^18). `fromEthDecimal()` parses strings directly — avoids `5.899 * 1e18` float rounding.

**Price Snapshots:** `getAllPrices()` returns `PriceSnapshot { prices, fetchedAt }`. Checkout adds `priceValidUntil` (30s window).

**Cart stores only quantities.** Prices fetched lazily at `total()` time.

**Promotions return `null` when conditions aren't met.** Distinguishes "didn't trigger" from "zero discount."

**Strategy pattern for conflict resolution** when multiple promotions apply to the same product:
- **MIN** — pick cheapest result (default)
- **PRIORITY** — highest-priority promotion wins
- **STACK** — multiplicative stacking

## Promotion Rules

### Buy 2 Get 1 Free (APE, AZUKI)

For every 3 items, pay for 2. Formula: `paidItems = floor(qty / 3) * 2 + (qty % 3)`

### Bulk 20% Discount (PUNK, AZUKI)

When quantity >= 3, each unit drops 20%.

### AZUKI Dual-Eligibility

```
3 AZUKI at 30 ETH:
  B2G1F:    2 × 30 = 60 ETH
  Bulk 20%: 3 × 24 = 72 ETH
  MIN picks: 60 ETH

STACK: 60 × (72/90) = 48 ETH
```

## OpenSea Integration

| Product | Slug |
|---------|------|
| APE | `boredapeyachtclub` |
| PUNK | `cryptopunks` |
| AZUKI | `azuki` |
| MEEBIT | `meebits` |

- Circuit breaker (5 failures → open, 30s reset)
- Inflight request deduplication
- Stale-while-revalidate
- Retry with exponential backoff (2 retries)
- Rate limit detection (429 + Retry-After)
- Parallel fetch via `Promise.allSettled` with partial failure merge
- In-memory cache (default 60s TTL)

## Infrastructure

- Express 5 + Helmet
- Rate limiting: 100 req/min per IP
- Pino structured logging + correlation ID (`X-Correlation-ID`)
- Input validation via type guards, quantity limits
- DoS protection: max 50 items/checkout, 1,000 qty/item, 10,000/product in Cart
- Only `CheckoutError` exposed to clients
- Graceful shutdown (SIGINT/SIGTERM, 10s timeout)

## The "135 ETH" Question

*APE, PUNK, APE → 210 ETH (or 135?)*

**210 ETH.** B2G1F needs 3 items. With 2 APE it doesn't trigger. Total = 2 × 75 + 60 = 210.

## Environment Variables

```env
PORT=3001
OPENSEA_API_KEY=
PROMOTION_STRATEGY=MIN              # MIN | PRIORITY | STACK
PRICE_CACHE_TTL_MS=60000
NODE_ENV=development
```

## Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

<img width="700" height="673" alt="image" src="https://github.com/user-attachments/assets/7669da00-8604-4dd0-8da5-7abe83ae7981" />


Mock prices: APE=75, PUNK=60, AZUKI=30, MEEBIT=4 ETH.


## Extensibility

**New promotion:** implement `Promotion`, register in `server.ts`.

**New strategy:** implement `PromotionStrategy`, add to `factory.ts`.

**New product:** add to `ProductCode` union + `PRODUCT_SLUGS`.

**New price source:** implement `PriceProvider`, swap in `server.ts`.
