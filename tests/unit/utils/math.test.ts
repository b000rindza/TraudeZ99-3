import { describe, it, expect } from 'vitest';
import { round, pctChange, clamp } from '../../../src/utils/math.js';

describe('round', () => {
  it('rounds to the specified number of decimal places', () => {
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(3.145, 2)).toBe(3.15);
    expect(round(100, 0)).toBe(100);
  });
});

describe('pctChange', () => {
  it('calculates percentage change correctly', () => {
    expect(pctChange(100, 110)).toBe(10);
    expect(pctChange(100, 90)).toBe(-10);
    expect(pctChange(50, 50)).toBe(0);
  });

  it('returns 0 when from is 0', () => {
    expect(pctChange(0, 100)).toBe(0);
  });
});

describe('clamp', () => {
  it('clamps values within the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
