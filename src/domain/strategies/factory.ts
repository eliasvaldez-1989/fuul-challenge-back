import type { PromotionStrategy } from './promotion.js';
import { MinStrategy } from './min.js';
import { PriorityStrategy } from './priority.js';
import { StackStrategy } from './stack.js';

export type StrategyType = 'MIN' | 'PRIORITY' | 'STACK';

const ALL_STRATEGIES: readonly StrategyType[] = ['MIN', 'PRIORITY', 'STACK'];

export function isStrategyType(value: unknown): value is StrategyType {
  return typeof value === 'string' && ALL_STRATEGIES.includes(value as StrategyType);
}

export function createStrategy(type: StrategyType): PromotionStrategy {
  switch (type) {
    case 'MIN':
      return new MinStrategy();
    case 'PRIORITY':
      return new PriorityStrategy();
    case 'STACK':
      return new StackStrategy();
  }
}
