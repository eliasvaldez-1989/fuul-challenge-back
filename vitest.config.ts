import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/types.ts',
        'src/domain/entities/cart-item.ts',
        'src/domain/promotions/promotion.ts',
        'src/domain/strategies/promotion.ts',
        'src/infrastructure/providers/price.ts',
        'src/application/dto/checkout-request.ts',
        'src/application/dto/checkout-response.ts',
      ],
    },
  },
});
