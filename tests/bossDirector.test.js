import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createBossDirector,
  spawnBoss,
  isBossAlive,
  getActiveBoss,
  tickBossDirector,
  computeBossHp
} from '../server/bossDirector.js';
import {
  BOSS_FIRST_SPAWN_TIME,
  BOSS_SPAWN_INTERVAL,
  BOSS_HP_BASE,
  BOSS_HP_PER_TIER,
  BOSS_HP_PER_PLAYER,
  BOSS_MAX_TIER
} from '../shared/constants.js';

// Minimal player-ship stub for use as playerPositions / playerShips
function makePlayer(x = 500, y = 500) {
  return { x, y, alive: true };
}

const WORLD = { width: 3000, height: 2100 };

describe('boss_first_spawn_at_tier_2', () => {
  it('does not spawn before BOSS_FIRST_SPAWN_TIME and spawns on the first tick that meets the threshold', () => {
    const director = createBossDirector();
    const players = [makePlayer()];

    // No boss before the threshold
    tickBossDirector(director, players, WORLD, BOSS_FIRST_SPAWN_TIME - 1, null);
    expect(isBossAlive(director)).toBe(false);

    // Boss spawns at exactly BOSS_FIRST_SPAWN_TIME
    tickBossDirector(director, players, WORLD, BOSS_FIRST_SPAWN_TIME, null);
    expect(isBossAlive(director)).toBe(true);

    const boss = getActiveBoss(director);
    expect(boss).not.toBeNull();
    expect(boss.ship.isBoss).toBe(true);
    expect(boss.ship.name).toBe('War Galleon');
  });
});

describe('boss_hp_scales_with_tier_and_players', () => {
  it('HP formula accounts for tier and player count', () => {
    // computeBossHp should scale with both parameters
    const hpTier1p1 = computeBossHp(1, 1);
    const hpTier2p1 = computeBossHp(2, 1);
    const hpTier2p2 = computeBossHp(2, 2);
    const hpTier4p4 = computeBossHp(4, 4);

    // Higher tier → more HP
    expect(hpTier2p1).toBeGreaterThan(hpTier1p1);
    // More players → more HP
    expect(hpTier2p2).toBeGreaterThan(hpTier2p1);
    // Max tier / max players → highest HP
    expect(hpTier4p4).toBeGreaterThan(hpTier2p2);

    // Exact formula: BOSS_HP_BASE + tier * BOSS_HP_PER_TIER + playerCount * BOSS_HP_PER_PLAYER
    expect(hpTier2p1).toBe(BOSS_HP_BASE + 2 * BOSS_HP_PER_TIER + 1 * BOSS_HP_PER_PLAYER);
    expect(hpTier4p4).toBe(BOSS_HP_BASE + 4 * BOSS_HP_PER_TIER + 4 * BOSS_HP_PER_PLAYER);
  });

  it('spawned boss receives HP computed from tier and current player count', () => {
    const director = createBossDirector();
    const players = [makePlayer(), makePlayer(200, 200)]; // 2 players

    // Spawn at BOSS_FIRST_SPAWN_TIME so tier = floor(150/150)+1 = 2
    spawnBoss(director, players, BOSS_FIRST_SPAWN_TIME, WORLD);

    const expectedHp = computeBossHp(2, 2);
    expect(director.boss.ship.maxHp).toBe(expectedHp);
    expect(director.boss.ship.hp).toBe(expectedHp);
  });

  it('clamps tier at BOSS_MAX_TIER', () => {
    expect(computeBossHp(BOSS_MAX_TIER + 99, 1))
      .toBe(computeBossHp(BOSS_MAX_TIER, 1));
  });
});

describe('boss_single_instance_limit', () => {
  it('does not spawn a second boss while one is already alive', () => {
    const director = createBossDirector();
    const players = [makePlayer()];

    // First spawn
    tickBossDirector(director, players, WORLD, BOSS_FIRST_SPAWN_TIME, null);
    expect(isBossAlive(director)).toBe(true);
    const firstBossId = director.boss.ship.id;

    // Attempt to spawn again well past nextBossTime — boss is still alive
    tickBossDirector(director, players, WORLD, BOSS_FIRST_SPAWN_TIME + BOSS_SPAWN_INTERVAL + 1, null);
    expect(isBossAlive(director)).toBe(true);
    expect(director.boss.ship.id).toBe(firstBossId); // same boss, not replaced
  });

  it('defers spawn until existing boss is dead', () => {
    const director = createBossDirector();
    const players = [makePlayer()];

    // Spawn first boss
    tickBossDirector(director, players, WORLD, BOSS_FIRST_SPAWN_TIME, null);
    expect(isBossAlive(director)).toBe(true);

    // Kill the boss
    director.boss.ship.alive = false;

    // tickBossDirector detects death, sets nextBossTime, clears director.boss
    const timeOfDeath = BOSS_FIRST_SPAWN_TIME + 10;
    tickBossDirector(director, players, WORLD, timeOfDeath, null);
    expect(director.boss).toBeNull();

    // Before nextBossTime no new spawn
    tickBossDirector(director, players, WORLD, timeOfDeath + BOSS_SPAWN_INTERVAL - 1, null);
    expect(isBossAlive(director)).toBe(false);

    // At nextBossTime new boss spawns
    tickBossDirector(director, players, WORLD, timeOfDeath + BOSS_SPAWN_INTERVAL, null);
    expect(isBossAlive(director)).toBe(true);
  });
});

describe('boss_cadence_per_round', () => {
  it('spawns 3-4 bosses across a full 10-minute round when each boss dies immediately', () => {
    const director = createBossDirector();
    const players = [makePlayer()];
    const ROUND_DURATION = 600;
    const TICK_DT = 0.05;

    let spawnCount = 0;
    let t = 0;

    while (t <= ROUND_DURATION) {
      const wasAlive = isBossAlive(director);
      tickBossDirector(director, players, WORLD, t, null);

      // Detect new spawn
      if (!wasAlive && isBossAlive(director)) {
        spawnCount++;
        // Immediately kill the boss so the next window opens after BOSS_SPAWN_INTERVAL
        director.boss.ship.alive = false;
      }

      t += TICK_DT;
    }

    expect(spawnCount).toBeGreaterThanOrEqual(3);
    expect(spawnCount).toBeLessThanOrEqual(4);
  });
});
