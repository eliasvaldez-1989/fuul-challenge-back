import { describe, it, expect } from 'vitest';
import { createStrategy, isStrategyType } from '../../../src/domain/strategies/factory.js';

describe('StrategyFactory', () => {
  it('creates MIN strategy', () => {
    expect(createStrategy('MIN').name).toBe('MIN');
  });

  it('creates PRIORITY strategy', () => {
    expect(createStrategy('PRIORITY').name).toBe('PRIORITY');
  });

  it('creates STACK strategy', () => {
    expect(createStrategy('STACK').name).toBe('STACK');
  });

  describe('isStrategyType', () => {
    it('accepts valid strategy types', () => {
      expect(isStrategyType('MIN')).toBe(true);
      expect(isStrategyType('PRIORITY')).toBe(true);
      expect(isStrategyType('STACK')).toBe(true);
    });

    it('rejects invalid values', () => {
      expect(isStrategyType('INVALID')).toBe(false);
      expect(isStrategyType('')).toBe(false);
      expect(isStrategyType(123)).toBe(false);
      expect(isStrategyType(null)).toBe(false);
      expect(isStrategyType(undefined)).toBe(false);
    });
  });
});
