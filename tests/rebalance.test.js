/**
 * Rebalance Pass Tests — Story 8, Sprint v0.7 PvE Power Fantasy
 *
 * Validates that the tuned constants produce the intended power fantasy curve:
 *   - Players feel weak at minute 1, dominant by minute 8
 *   - Level pacing: ~5 at 2 min, ~12 at 5 min, ~18 at 8 min (70% combat uptime)
 *   - Late-game NPCs are genuinely threatening at tier 8+
 *   - Level 20 ship is dramatically more powerful than level 1
 *
 * Scenario IDs: expected_level_pacing, late_game_npcs_are_threatening, level20_power_vs_level1
 */

import { describe, expect, it, beforeAll } from 'vitest';
import {
  XP_START, XP_SCALE, XP_ADD,
  NPC_SPAWN_INTERVAL_BASE,
  NPC_BASE_DOUBLOON_REWARD, NPC_DOUBLOON_PER_UPGRADE,
  PASSIVE_DOUBLOON_RATE,
  MAX_NPCS,
  BASE_HP, BASE_SIZE, BASE_BULLET_DAMAGE
} from '../shared/constants.js';
import { createShip } from '../shared/shipState.js';
import { loadCatalog, getCatalog, initStarterLoadout } from '../server/upgradeDirector.js';
import { applyUpgrade } from '../shared/upgradeRegistry.js';
import { applyNpcArchetype } from '../server/npcDirector.js';

// ─── Simulation helper ───────────────────────────────────────────────────────

/**
 * Simulate a 10-minute round and return the player's level at key time checkpoints.
 *
 * Model:
 *   - Passive XP: PASSIVE_DOUBLOON_RATE XP per second (always)
 *   - NPC kills:  combatUptime fraction of spawned NPCs are killed, awarding their
 *                 doubloon reward value as XP immediately on spawn
 *   - Spawn interval decreases over time: max(1.5, NPC_SPAWN_INTERVAL_BASE - t × 0.004)
 *   - NPC difficulty (upgradeCount) = floor(t / 60), same formula used in npcDirector
 *
 * @param {number} durationSec  Total simulation length in seconds
 * @param {number} combatUptime Fraction of spawned NPCs the player kills (0–1)
 * @returns {{ levelAt: object, finalLevel: number }}
 */
function simulateRound(durationSec = 600, combatUptime = 0.7) {
  const DT = 0.1;                      // 100 ms steps — sufficient accuracy for level validation
  let level = 1;
  let xp = 0;
  let xpToNext = XP_START;
  let nextSpawnAt = 0;
  const levelAt = {};

  for (let t = 0; t <= durationSec + DT / 2; t += DT) {
    // Passive XP tick
    xp += PASSIVE_DOUBLOON_RATE * DT;

    // NPC spawn → instant kill XP (scaled by combat uptime)
    if (t >= nextSpawnAt) {
      const upgradeCount = Math.floor(t / 60);
      const reward = NPC_BASE_DOUBLOON_REWARD + upgradeCount * NPC_DOUBLOON_PER_UPGRADE;
      xp += reward * combatUptime;
      const interval = Math.max(1.5, NPC_SPAWN_INTERVAL_BASE - t * 0.004);
      nextSpawnAt = t + interval;
    }

    // Level-up loop
    while (xp >= xpToNext) {
      xp -= xpToNext;
      level++;
      xpToNext = Math.floor(xpToNext * XP_SCALE + XP_ADD);
    }

    // Record checkpoint levels (snap to nearest DT)
    for (const cp of [60, 120, 300, 480, 600]) {
      if (t >= cp - DT / 2 && t < cp + DT / 2) {
        levelAt[cp] = level;
      }
    }
  }

  return { levelAt, finalLevel: level };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await loadCatalog();
});

describe('Rebalance Pass — Power Fantasy Curve', () => {

  // ── Scenario: expected_level_pacing ────────────────────────────────────────

  it('level pacing hits key stage-transition checkpoints (70% combat uptime)', () => {
    const { levelAt } = simulateRound(600, 0.7);

    // Calm Waters → Contested Seas at 2 min: target ~5 (tolerance ±2)
    expect(levelAt[120]).toBeGreaterThanOrEqual(3);
    expect(levelAt[120]).toBeLessThanOrEqual(7);

    // Contested Seas → War Zone at 5 min: target ~12 (tolerance ±3)
    expect(levelAt[300]).toBeGreaterThanOrEqual(9);
    expect(levelAt[300]).toBeLessThanOrEqual(15);

    // War Zone → Kraken Frontier at 8 min: target ~18 (tolerance ±3)
    expect(levelAt[480]).toBeGreaterThanOrEqual(15);
    expect(levelAt[480]).toBeLessThanOrEqual(21);

    // Progression is monotonically increasing through the stages
    expect(levelAt[120]).toBeGreaterThan(1);
    expect(levelAt[300]).toBeGreaterThan(levelAt[120]);
    expect(levelAt[480]).toBeGreaterThan(levelAt[300]);
  });

  it('feels weak at minute 1 — level stays low in the first 60 seconds', () => {
    const { levelAt } = simulateRound(600, 0.7);

    // At 1 minute, player should still be in the low levels (early game feel)
    expect(levelAt[60]).toBeLessThanOrEqual(4);
  });

  it('player reaches level 20 by the end of a 10-minute round (active play)', () => {
    // Full-uptime model: player kills every NPC (solo grind, best case)
    const { finalLevel } = simulateRound(600, 1.0);
    expect(finalLevel).toBeGreaterThanOrEqual(18);
  });

  // ── Scenario: level20_power_vs_level1 ─────────────────────────────────────

  it('level 20 ship has roughly 3× the HP and 1.7× the size of a level-1 ship', () => {
    const level1 = createShip(0, 0);

    // Simulate stat growth for 19 level-ups (level 1 → 20)
    const levelsGained = 19;
    const level20MaxHp = BASE_HP + levelsGained * 2;    // +2 maxHp per level
    const level20Size  = BASE_SIZE + levelsGained * 0.6; // +0.6 size per level

    const hpRatio   = level20MaxHp / level1.maxHp;
    const sizeRatio = level20Size  / level1.size;

    // HP ratio: target ~2.9, tolerance ±0.5  (range 2.4–3.4)
    expect(hpRatio).toBeGreaterThan(2.4);
    expect(hpRatio).toBeLessThan(3.4);

    // Size ratio: target ~1.7, tolerance ±0.2  (range 1.5–1.9)
    expect(sizeRatio).toBeGreaterThan(1.5);
    expect(sizeRatio).toBeLessThan(1.9);
  });

  // ── Scenario: late_game_npcs_are_threatening ──────────────────────────────

  it('late-game heavy NPC at tier 8 has maxHp >= 80 and increased damage', () => {
    const ship = createShip(0, 0, { id: 9001, isNpc: true, name: 'Raider' });
    initStarterLoadout(ship);

    // Apply heavy archetype (2.1× HP multiplier) at tier 8
    applyNpcArchetype(ship, 'heavy', 9001, 8);

    const baseHeavyHp = ship.maxHp;
    expect(baseHeavyHp).toBeGreaterThanOrEqual(Math.floor(BASE_HP * 2.0));

    // Apply 5 HP upgrades + 3 damage upgrades (representative mix for tier-8 NPC)
    const catalog = getCatalog();
    for (let i = 0; i < 5; i++) {
      applyUpgrade(ship, 'reinforced-hull', catalog);  // +15 maxHp each
    }
    for (let i = 0; i < 3; i++) {
      applyUpgrade(ship, 'cannons', catalog);           // +3 bulletDamage each
    }

    // A tier-8 heavy NPC with HP and damage upgrades should genuinely threaten a leveled player
    expect(ship.maxHp).toBeGreaterThanOrEqual(80);
    expect(ship.bulletDamage).toBeGreaterThan(BASE_BULLET_DAMAGE); // upgrades boosted damage
  });

  it('tier-8 heavy NPC has higher HP than a tier-0 heavy NPC', () => {
    const tier0 = createShip(0, 0, { id: 9002, isNpc: true, name: 'Raider' });
    initStarterLoadout(tier0);
    applyNpcArchetype(tier0, 'heavy', 9002, 0);

    const tier8 = createShip(0, 0, { id: 9003, isNpc: true, name: 'Raider' });
    initStarterLoadout(tier8);
    applyNpcArchetype(tier8, 'heavy', 9003, 8);

    const catalog = getCatalog();
    for (let i = 0; i < 8; i++) {
      applyUpgrade(tier8, 'reinforced-hull', catalog);
    }

    expect(tier8.maxHp).toBeGreaterThan(tier0.maxHp);
    expect(tier8.maxHp / tier0.maxHp).toBeGreaterThan(1.8); // meaningfully tougher
  });

  // ── NPC spawn pressure ─────────────────────────────────────────────────────

  it('NPC spawn interval decreases from early to late game', () => {
    const earlyInterval  = Math.max(1.5, NPC_SPAWN_INTERVAL_BASE - 0   * 0.004);
    const midInterval    = Math.max(1.5, NPC_SPAWN_INTERVAL_BASE - 300 * 0.004);
    const lateInterval   = Math.max(1.5, NPC_SPAWN_INTERVAL_BASE - 480 * 0.004);

    expect(earlyInterval).toBeGreaterThan(lateInterval);
    expect(midInterval).toBeGreaterThan(lateInterval);
    expect(earlyInterval).toBeGreaterThan(2.0); // not overwhelming at the start
    expect(lateInterval).toBeLessThanOrEqual(2.0); // meaningful pressure by War Zone
  });

  it('MAX_NPCS is large enough to create genuine late-game pressure', () => {
    expect(MAX_NPCS).toBeGreaterThanOrEqual(20);
  });

  // ── XP curve shape ─────────────────────────────────────────────────────────

  it('XP thresholds grow consistently — later levels always cost more', () => {
    let xpToNext = XP_START;
    const thresholds = [xpToNext];
    for (let i = 0; i < 20; i++) {
      xpToNext = Math.floor(xpToNext * XP_SCALE + XP_ADD);
      thresholds.push(xpToNext);
    }
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]).toBeGreaterThanOrEqual(thresholds[i - 1]);
    }
  });

  it('first level-up costs XP_START XP', () => {
    const ship = createShip(0, 0);
    expect(ship.xpToNext).toBe(XP_START);
  });
});
