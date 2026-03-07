import { describe, expect, it } from 'vitest';
import { createShip } from '../shared/shipState.js';
import { resolveShipCollision, stepShipPhysics } from '../shared/physics.js';

const world = { width: 3600, height: 2600 };

function makeShip(overrides = {}) {
  const ship = createShip(200, 200, { id: overrides.id ?? 1, heading: overrides.heading ?? 0 });
  ship.alive = true;
  ship.invulnTimer = 0;
  ship.impactTimer = 0;
  Object.assign(ship, overrides);
  return ship;
}

describe('shared physics wind parity', () => {
  it('makes tailwinds faster and headwinds slower', () => {
    const tailwindShip = makeShip({ speed: 1, sailOpen: true, heading: 0 });
    const calmShip = makeShip({ id: 2, speed: 1, sailOpen: true, heading: 0 });
    const headwindShip = makeShip({ id: 3, speed: 1, sailOpen: true, heading: Math.PI });
    const input = { forward: false, brake: false, turnLeft: false, turnRight: false, sailOpen: true, anchored: false };
    const dt = 0.2;

    stepShipPhysics(tailwindShip, input, { x: 0.55, y: 0 }, world, dt);
    stepShipPhysics(calmShip, input, { x: 0, y: 0 }, world, dt);
    stepShipPhysics(headwindShip, input, { x: 0.55, y: 0 }, world, dt);

    expect(tailwindShip.speed).toBeGreaterThan(calmShip.speed + 0.05);
    expect(headwindShip.speed).toBeLessThan(calmShip.speed - 0.02);
  });
});

describe('shared physics ram parity', () => {
  it('rewards high-speed bow-first rams more than normal impacts', () => {
    const rammer = makeShip({ speed: 3.1, heading: 0, ram: true, ramDamage: 84, x: 200, y: 200 });
    const defender = makeShip({ id: 2, speed: 0.4, heading: 0, x: 222, y: 200 });
    const baselineAttacker = makeShip({ id: 3, speed: 3.1, heading: 0, ram: false, x: 200, y: 240 });
    const baselineDefender = makeShip({ id: 4, speed: 0.4, heading: 0, x: 222, y: 240 });

    const ramResult = resolveShipCollision(rammer, defender, world);
    const baselineResult = resolveShipCollision(baselineAttacker, baselineDefender, world);

    expect(ramResult).not.toBeNull();
    expect(baselineResult).not.toBeNull();
    expect(ramResult.impactB).toBeGreaterThan(baselineResult.impactB + 2);
    expect(ramResult.impactA).toBeLessThan(baselineResult.impactA);
  });

  it('does not register low-speed bumping as impact damage', () => {
    const shipA = makeShip({ speed: 0.7, heading: 0, ram: true, ramDamage: 84, x: 200, y: 200 });
    const shipB = makeShip({ id: 2, speed: 0.5, heading: 0, x: 222, y: 200 });

    const result = resolveShipCollision(shipA, shipB, world);

    expect(result).toBeNull();
  });
});