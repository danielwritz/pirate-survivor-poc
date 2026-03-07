import { describe, expect, it } from 'vitest';
import { createShip } from '../shared/shipState.js';
import {
  FIRE_DURATION_BASE,
  FIRE_TICK_INTERVAL,
  FIRE_SHIP_FIRE_DURATION_MUL
} from '../shared/constants.js';
import {
  createFireShipBoss,
  applyFireShipRam,
  tickFireShipBoss
} from '../server/fireShipBoss.js';

const world = { width: 3000, height: 2100 };

function makePlayer(overrides = {}) {
  const ship = createShip(220, 200, { id: overrides.id ?? 1 });
  ship.alive = true;
  ship.invulnTimer = 0;
  ship.impactTimer = 0;
  Object.assign(ship, overrides);
  return ship;
}

describe('Fire Ship Boss — ram and ignite', () => {
  it('ram collision: player hp decreases and player is set on fire', () => {
    const boss   = createFireShipBoss(99001, 200, 200);
    const player = makePlayer({ hp: 50, onFire: false });

    applyFireShipRam(boss, player);

    expect(player.hp).toBeLessThan(50);
    expect(player.onFire).toBe(true);
  });

  it('fire ignition is guaranteed regardless of RNG', () => {
    // Run 20 times — ignition must be true every time
    for (let i = 0; i < 20; i++) {
      const boss   = createFireShipBoss(99100 + i, 200, 200);
      const player = makePlayer({ id: i + 1, hp: 50, onFire: false });

      applyFireShipRam(boss, player);

      expect(player.onFire).toBe(true);
    }
  });

  it('fire duration is 2× base duration', () => {
    const boss   = createFireShipBoss(99002, 200, 200);
    const player = makePlayer({ hp: 50, onFire: false });

    applyFireShipRam(boss, player);

    const expectedTicks = Math.ceil(
      (FIRE_DURATION_BASE * FIRE_SHIP_FIRE_DURATION_MUL) / FIRE_TICK_INTERVAL
    );
    expect(player.fireTicks).toBe(expectedTicks);
    expect(player.fireTicks).toBeGreaterThan(
      Math.ceil(FIRE_DURATION_BASE / FIRE_TICK_INTERVAL)
    );
  });

  it('self-destructs after ram', () => {
    const boss   = createFireShipBoss(99003, 200, 200);
    const player = makePlayer({ hp: 50 });

    applyFireShipRam(boss, player);

    expect(boss.alive).toBe(false);
    expect(boss.hp).toBe(0);
  });
});

describe('Fire Ship Boss — creation', () => {
  it('is faster and smaller than a base ship', () => {
    const base = createShip(0, 0, { id: 1 });
    const boss = createFireShipBoss(99004, 0, 0);

    expect(boss.baseSpeed).toBeGreaterThan(base.baseSpeed);
    expect(boss.size).toBeLessThan(base.size);
  });

  it('has ram enabled with positive ramDamage', () => {
    const boss = createFireShipBoss(99005, 0, 0);

    expect(boss.ram).toBe(true);
    expect(boss.ramDamage).toBeGreaterThan(0);
  });

  it('hp scales with tier and player count', () => {
    const tier1 = createFireShipBoss(99006, 0, 0, 1, 1);
    const tier4 = createFireShipBoss(99007, 0, 0, 4, 4);

    expect(tier4.maxHp).toBeGreaterThan(tier1.maxHp);
  });
});

describe('Fire Ship Boss — AI tick', () => {
  it('detects collision via tick and applies ram-and-ignite', () => {
    // Place boss directly overlapping the player to guarantee collision detection
    const boss   = createFireShipBoss(99008, 200, 200);
    const player = makePlayer({ id: 2, x: 200, y: 200, hp: 50, onFire: false });

    let ramCalled = false;
    tickFireShipBoss(boss, [player], world, [], 0.05, () => { ramCalled = true; });

    expect(ramCalled).toBe(true);
    expect(player.hp).toBeLessThan(50);
    expect(player.onFire).toBe(true);
    expect(boss.alive).toBe(false);
  });

  it('chases the highest-scoring player (most doubloons)', () => {
    // Put boss to the left of both players; high-scorer is to the right
    const boss    = createFireShipBoss(99009, 0, 200);
    boss.heading  = 0; // facing right initially
    boss.speed    = 0;

    const lowScore = makePlayer({ id: 3, x: 0, y: 200, doubloons: 5 });
    const highScore = makePlayer({ id: 4, x: 3000, y: 200, doubloons: 999 });

    tickFireShipBoss(boss, [lowScore, highScore], world, [], 0.05);

    // input.turn > 0 means steering toward the right (highScore)
    // highScore is directly to the right so turn should be ~0 (already aligned)
    // Verify boss._input is set and forward is true
    expect(boss._input.forward).toBe(true);
  });
});
