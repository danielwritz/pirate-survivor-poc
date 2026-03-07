import { describe, expect, it } from 'vitest';
import { distributeBossKillRewards } from '../server/bossDirector.js';
import {
  BOSS_KILL_BASE_DOUBLOONS,
  BOSS_KILL_DOUBLOONS_PER_TIER,
} from '../shared/constants.js';

// Scenario: boss_kill_reward
// Killing a tier-4 boss drops 80-100 doubloons and triggers majorOfferTriggered.
describe('boss_kill_reward', () => {
  it('tier-4 boss kill grants 80-100 doubloons and sets majorOfferTriggered on the killer', () => {
    const boss   = { x: 1000, y: 1000, isBoss: true };
    const killer = { id: 1, x: 980, y: 1000, doubloons: 0 };

    const { killerDoubloons } = distributeBossKillRewards(boss, killer, [killer], 4);

    // Formula: 50 + 10 * 4 = 90 (acceptance spec: [80, 100])
    expect(killerDoubloons).toBeGreaterThanOrEqual(80);
    expect(killerDoubloons).toBeLessThanOrEqual(100);
    expect(killer.doubloons).toBe(killerDoubloons);
    expect(killer.majorOfferTriggered).toBe(true);
  });

  it('computes killer doubloons from constants (base + tier * perTier)', () => {
    const boss   = { x: 0, y: 0, isBoss: true };
    const killer = { id: 1, x: 0, y: 0, doubloons: 0 };

    const { killerDoubloons } = distributeBossKillRewards(boss, killer, [killer], 4);
    expect(killerDoubloons).toBe(BOSS_KILL_BASE_DOUBLOONS + BOSS_KILL_DOUBLOONS_PER_TIER * 4);
  });
});

// Scenario: boss_kill_splash_reward
// Player within 300 units gets 20-35 splash doubloons; player at 800 units gets nothing.
describe('boss_kill_splash_reward', () => {
  it('nearby players (≤300 units) get 30% splash; distant players (>300 units) get nothing', () => {
    const boss   = { x: 1000, y: 1000, isBoss: true };
    const killer = { id: 1, x:  980, y: 1000, doubloons: 0 }; // ~20 units from boss
    const nearby = { id: 2, x: 1050, y: 1000, doubloons: 0 }; //  50 units from boss
    const far    = { id: 3, x: 1800, y: 1000, doubloons: 0 }; // 800 units from boss

    distributeBossKillRewards(boss, killer, [killer, nearby, far], 4);

    // Killer receives full reward (tier 4: 90 doubloons, in [80, 100])
    expect(killer.doubloons).toBeGreaterThanOrEqual(80);
    expect(killer.doubloons).toBeLessThanOrEqual(100);

    // Nearby player receives splash: floor(90 * 0.3) = 27 doubloons
    expect(nearby.doubloons).toBe(27);

    // Far player receives nothing
    expect(far.doubloons).toBe(0);
  });
});
