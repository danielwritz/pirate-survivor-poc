import { describe, expect, it } from 'vitest';
import { calculateRoundPlayerScore } from '../server/simulation.js';

describe('round score formula', () => {
  it('always grants a 10% round completion base score', () => {
    expect(calculateRoundPlayerScore(0, 0, 200)).toBe(20);
    expect(calculateRoundPlayerScore(0, 4, 200)).toBe(20);
  });

  it('adds PvP bonus on top of base score using kills/deaths*doubloons', () => {
    // base = 20, pvp = (10/5)*200 = 400
    expect(calculateRoundPlayerScore(10, 5, 200)).toBe(420);
    // base = 20, pvp = (2/5)*200 = 80
    expect(calculateRoundPlayerScore(2, 5, 200)).toBe(100);
  });

  it('ignores invalid PvP ratios and only keeps base score', () => {
    expect(calculateRoundPlayerScore(5, 0, 200)).toBe(20);
    expect(calculateRoundPlayerScore(Number.NaN, 1, 200)).toBe(20);
  });
});
