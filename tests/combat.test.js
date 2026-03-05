import { describe, expect, it, vi, afterEach } from 'vitest';
import { createShip } from '../shared/shipState.js';
import { fireCannonBroadside, tickGunAutoFire } from '../shared/combat.js';
import { getHullShape, getHullSideMount } from '../src/core/shipMath.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function baseShip() {
  const ship = createShip(0, 0, { id: 1, name: 'Test', heading: 0 });
  ship.alive = true;
  ship.gunners = 32;
  ship.cannonReload = 1;
  ship.cannonPivot = 180;
  ship.gunReload = 1;
  ship.bulletSpeed = 6;
  ship.bulletDamage = 9;
  ship.weaponLayout = {
    port: ['cannon', 'cannon'],
    starboard: ['cannon', 'cannon']
  };
  ship.cannonMountTimers = {
    port: [10, 10],
    starboard: [10, 10]
  };
  ship.gunMountTimers = {
    port: [10, 10],
    starboard: [10, 10]
  };
  return ship;
}

describe('combat per-mount cannon behavior', () => {
  it('fires only ready cannons and keeps opposite side independent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const ship = baseShip();
    const spawned = [];
    const spawnBullet = (b) => spawned.push(b);

    const firedPort = fireCannonBroadside(ship, 'port', -Math.PI / 2, spawnBullet);
    expect(firedPort).toBe(true);
    expect(spawned.length).toBe(2);
    expect(ship.cannonMountTimers.port).toEqual([0, 0]);

    const firedStarboard = fireCannonBroadside(ship, 'starboard', Math.PI / 2, spawnBullet);
    expect(firedStarboard).toBe(true);
    expect(spawned.length).toBe(4);
    expect(ship.cannonMountTimers.starboard).toEqual([0, 0]);

    ship.cannonMountTimers.port = [0.2, 2.0];
    const firedPartial = fireCannonBroadside(ship, 'port', -Math.PI / 2, spawnBullet);
    expect(firedPartial).toBe(true);
    expect(spawned.length).toBe(5);
  });

  it('rejects shots outside each cannon mount line-of-fire', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const ship = baseShip();
    ship.cannonPivot = 0;
    const spawned = [];
    const spawnBullet = (b) => spawned.push(b);

    const firedInvalid = fireCannonBroadside(ship, 'starboard', 0, spawnBullet);
    expect(firedInvalid).toBe(false);
    expect(spawned.length).toBe(0);

    const firedValid = fireCannonBroadside(ship, 'starboard', Math.PI / 2, spawnBullet);
    expect(firedValid).toBe(true);
    expect(spawned.length).toBeGreaterThanOrEqual(1);
    for (const bullet of spawned) {
      expect(Math.abs(bullet.vx)).toBeLessThan(1e-6);
      expect(bullet.vy).toBeGreaterThan(0);
    }
  });
});

describe('combat per-mount gun behavior', () => {
  it('fires only ready gun mounts with valid in-range targets', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const ship = createShip(0, 0, { id: 2, name: 'Gunner', heading: -Math.PI / 2 });
    ship.alive = true;
    ship.gunners = 20;
    ship.gunReload = 1;
    ship.weaponLayout = {
      port: ['empty', 'empty'],
      starboard: ['gun', 'gun']
    };
    ship.gunMountTimers = {
      port: [0, 0],
      starboard: [2.0, 0.2]
    };

    const shape = getHullShape(ship);
    const mount = getHullSideMount(shape, 0, ship.weaponLayout.starboard.length, 1);
    const cos = Math.cos(ship.heading);
    const sin = Math.sin(ship.heading);
    const worldNx = mount.nx * cos - mount.ny * sin;
    const worldNy = mount.nx * sin + mount.ny * cos;
    const targetDist = 80;
    const target = {
      id: 99,
      ship: {
        id: 99,
        alive: true,
        x: worldNx * targetDist,
        y: worldNy * targetDist
      }
    };

    const bullets = [];
    tickGunAutoFire(
      ship,
      [target],
      0,
      (b) => bullets.push(b)
    );

    expect(bullets.length).toBe(2);
    for (const bullet of bullets) {
      const dot = bullet.vx * worldNx + bullet.vy * worldNy;
      expect(dot).toBeGreaterThan(0);
    }

    bullets.length = 0;
    ship.gunMountTimers.starboard = [2.0, 2.0];
    tickGunAutoFire(
      ship,
      [{ id: 101, ship: { id: 101, alive: true, x: 0, y: 9999 } }],
      0,
      (b) => bullets.push(b)
    );
    expect(bullets.length).toBe(0);
  });
});
