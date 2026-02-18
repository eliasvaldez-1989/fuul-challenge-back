import { describe, it, expect } from 'vitest';
import { Cart, CartError } from '../../../src/domain/entities/cart.js';

describe('Cart', () => {
  it('starts empty', () => {
    const cart = new Cart();
    expect(cart.isEmpty()).toBe(true);
    expect(cart.getQuantities().size).toBe(0);
  });

  it('scan adds one unit', () => {
    const cart = new Cart();
    cart.scan('APE');
    expect(cart.getQuantities().get('APE')).toBe(1);
    expect(cart.isEmpty()).toBe(false);
  });

  it('multiple scans increment quantity', () => {
    const cart = new Cart();
    cart.scan('APE');
    cart.scan('APE');
    cart.scan('APE');
    expect(cart.getQuantities().get('APE')).toBe(3);
  });

  it('scans different products independently', () => {
    const cart = new Cart();
    cart.scan('APE');
    cart.scan('PUNK');
    cart.scan('APE');
    expect(cart.getQuantities().get('APE')).toBe(2);
    expect(cart.getQuantities().get('PUNK')).toBe(1);
  });

  it('remove decrements quantity', () => {
    const cart = new Cart();
    cart.scan('APE');
    cart.scan('APE');
    cart.remove('APE');
    expect(cart.getQuantities().get('APE')).toBe(1);
  });

  it('remove last unit removes product from map', () => {
    const cart = new Cart();
    cart.scan('APE');
    cart.remove('APE');
    expect(cart.getQuantities().has('APE')).toBe(false);
    expect(cart.isEmpty()).toBe(true);
  });

  it('remove from empty cart throws CartError', () => {
    const cart = new Cart();
    expect(() => cart.remove('APE')).toThrow(CartError);
  });

  it('remove non-existent product throws CartError', () => {
    const cart = new Cart();
    cart.scan('PUNK');
    expect(() => cart.remove('APE')).toThrow(CartError);
  });

  it('clear empties the cart', () => {
    const cart = new Cart();
    cart.scan('APE');
    cart.scan('PUNK');
    cart.clear();
    expect(cart.isEmpty()).toBe(true);
  });

  it('rejects quantity exceeding per-product limit', () => {
    const cart = new Cart();
    for (let i = 0; i < 10_000; i++) {
      cart.scan('APE');
    }
    expect(cart.getQuantities().get('APE')).toBe(10_000);
    expect(() => cart.scan('APE')).toThrow(CartError);
    expect(() => cart.scan('APE')).toThrow(/max 10000/);
  });
});
