import { describe, expect, it } from 'vitest';
import { createShip } from '../shared/shipState.js';
import { fireCannonBroadside } from '../shared/combat.js';
import {
  applyWarGalleonArchetype,
  createBossDirector,
  spawnBoss,
  removeBoss,
  tickBossDirector,
  isBossAlive,
  getActiveBoss
} from '../server/bossDirector.js';
import {
  BASE_SIZE,
  WAR_GALLEON_SIZE_MUL,
  WAR_GALLEON_CANNON_COUNT,
  WAR_GALLEON_BROADSIDE_INTERVAL,
  WAR_GALLEON_CANNON_DAMAGE,
  WAR_GALLEON_HP_PER_TIER,
  WAR_GALLEON_HP_PER_PLAYER,
  BOSS_FIRST_SPAWN_TIME
} from '../shared/constants.js';

// ─── Archetype stats ───

describe('War Galleon archetype stats', () => {
  it('sets ship size to ~3x BASE_SIZE', () => {
    const ship = createShip(0, 0, { id: 1, isNpc: true });
    applyWarGalleonArchetype(ship, 1, 1);
    expect(ship.size).toBeCloseTo(BASE_SIZE * WAR_GALLEON_SIZE_MUL, 1);
    expect(ship.isBoss).toBe(true);
    expect(ship.bossArchetype).toBe('war_galleon');
  });

  it('scales HP with tier and player count', () => {
    const ship = createShip(0, 0, { id: 2, isNpc: true });
    applyWarGalleonArchetype(ship, 4, 6);
    const expected = WAR_GALLEON_HP_PER_TIER * 4 + WAR_GALLEON_HP_PER_PLAYER * 6;
    expect(ship.maxHp).toBe(expected);
    expect(ship.hp).toBe(expected);
  });

  it('has 3 cannons per side (6 total)', () => {
    const ship = createShip(0, 0, { id: 3, isNpc: true });
    applyWarGalleonArchetype(ship, 1, 1);
    const portCannons      = ship.weaponLayout.port.filter(s => s === 'cannon').length;
    const starboardCannons = ship.weaponLayout.starboard.filter(s => s === 'cannon').length;
    expect(portCannons).toBe(WAR_GALLEON_CANNON_COUNT / 2);
    expect(starboardCannons).toBe(WAR_GALLEON_CANNON_COUNT / 2);
    expect(portCannons + starboardCannons).toBe(WAR_GALLEON_CANNON_COUNT);
  });
});

// ─── Broadside attack (scenario: boss_war_galleon_broadside) ───

describe('War Galleon broadside fires >= 4 heavy bullets with >= 30 total damage', () => {
  /**
   * Helper: create a fully configured War Galleon with all cannon timers charged.
   */
  function makeReadyGalleon(id = 10) {
    const ship = createShip(500, 500, { id, isNpc: true, heading: 0 });
    applyWarGalleonArchetype(ship, 2, 4);
    // All cannon mount timers pre-charged so every cannon fires immediately
    const cannonsPerSide = WAR_GALLEON_CANNON_COUNT / 2;
    ship.cannonMountTimers = {
      port:      Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL),
      starboard: Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL)
    };
    return ship;
  }

  it('fireCannonBroadside fires heavy cannonballs with correct damage per cannon', () => {
    const ship    = makeReadyGalleon(10);
    const bullets = [];
    // heading = 0 → starboard faces South (Math.PI / 2)
    fireCannonBroadside(ship, 'starboard', Math.PI / 2, b => bullets.push(b));

    expect(bullets.length).toBeGreaterThanOrEqual(1);
    for (const b of bullets) {
      expect(b.heavy).toBe(true);
      // dmg = bulletDamage + CANNON_DMG_BONUS
      expect(b.dmg).toBeGreaterThan(WAR_GALLEON_CANNON_DAMAGE);
    }
  });

  it('broadside fires >= 4 heavy bullets with >= 30 total potential damage', () => {
    // Scenario: boss_war_galleon_broadside
    // War Galleon fires both port and starboard simultaneously (6 total cannons)
    const ship    = makeReadyGalleon(11);
    const bullets = [];
    const spawnBullet = b => bullets.push(b);

    // heading = 0 (East): port → North (-π/2), starboard → South (π/2)
    // With cannonPivot = 180 all mounts rotate freely → both sides fire toward same angle
    fireCannonBroadside(ship, 'port',      Math.PI / 2, spawnBullet);

    // Recharge starboard timers (port already reset timers above; starboard still charged)
    const cannonsPerSide = WAR_GALLEON_CANNON_COUNT / 2;
    ship.cannonMountTimers.starboard = Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL);
    fireCannonBroadside(ship, 'starboard', Math.PI / 2, spawnBullet);

    const heavyBullets  = bullets.filter(b => b.heavy);
    const totalDamage   = heavyBullets.reduce((sum, b) => sum + b.dmg, 0);

    expect(heavyBullets.length).toBeGreaterThanOrEqual(4);
    expect(totalDamage).toBeGreaterThanOrEqual(30);
  });

  it('tickBossDirector fires >= 4 heavy bullets when boss is in broadside mode with target in range', () => {
    // Scenario: boss_war_galleon_broadside via AI tick
    const director = createBossDirector();
    // Force spawn by setting nextBossTime to 0 and providing player positions
    director.nextBossTime = 0;
    const player = createShip(900, 500, { id: 99 });
    player.alive = true;

    const bullets = [];
    const events  = [];
    const spawnBullet = b => bullets.push(b);

    // Trigger spawn
    tickBossDirector(director, [player], { width: 3000, height: 2100 }, BOSS_FIRST_SPAWN_TIME, 0.05, spawnBullet, events);
    expect(isBossAlive(director)).toBe(true);

    const boss = getActiveBoss(director);
    // Put boss into broadside mode with timer fully charged
    boss.aiState.mode          = 'broadside';
    boss.aiState.broadsideTimer = WAR_GALLEON_BROADSIDE_INTERVAL;
    boss.aiState.modeTimer     = 8;
    boss.ship.heading          = 0; // facing East

    // Place boss near the player
    boss.ship.x = 500;
    boss.ship.y = 500;

    // Charge all cannon mount timers
    const cannonsPerSide = WAR_GALLEON_CANNON_COUNT / 2;
    boss.ship.cannonMountTimers = {
      port:      Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL),
      starboard: Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL)
    };

    // Tick the director
    tickBossDirector(director, [player], { width: 3000, height: 2100 }, BOSS_FIRST_SPAWN_TIME + 1, 0.05, spawnBullet, events);

    const heavyBullets = bullets.filter(b => b.heavy);
    const totalDamage  = heavyBullets.reduce((sum, b) => sum + b.dmg, 0);

    expect(heavyBullets.length).toBeGreaterThanOrEqual(4);
    expect(totalDamage).toBeGreaterThanOrEqual(30);
    // Broadside event should be emitted
    expect(events.some(e => e.type === 'bossBroadside' && e.bossType === 'war_galleon')).toBe(true);
  });
});

// ─── Boss Director lifecycle ───

describe('Boss Director lifecycle', () => {
  it('spawnBoss creates a war_galleon with isBoss flag', () => {
    const director = createBossDirector();
    const positions = [{ x: 500, y: 500 }];
    const id = spawnBoss(director, positions, BOSS_FIRST_SPAWN_TIME, { width: 3000, height: 2100 });
    expect(isBossAlive(director)).toBe(true);
    const boss = getActiveBoss(director);
    expect(boss.ship.isBoss).toBe(true);
    expect(boss.ship.bossArchetype).toBe('war_galleon');
  });

  it('removeBoss clears the active boss', () => {
    const director = createBossDirector();
    const positions = [{ x: 500, y: 500 }];
    spawnBoss(director, positions, BOSS_FIRST_SPAWN_TIME, { width: 3000, height: 2100 });
    expect(isBossAlive(director)).toBe(true);
    removeBoss(director);
    expect(isBossAlive(director)).toBe(false);
  });
});
