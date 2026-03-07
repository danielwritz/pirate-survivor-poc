import { describe, expect, it } from 'vitest';
import { createShip } from '../shared/shipState.js';
import { initStarterLoadout } from '../server/upgradeDirector.js';
import { applyNpcArchetype, computeNpcReward, rollNpcArchetype } from '../server/npcDirector.js';

function createNpcBase(id = 1) {
  const ship = createShip(0, 0, { id, isNpc: true, name: 'Pirate' });
  initStarterLoadout(ship);
  return ship;
}

describe('npc director archetypes', () => {
  it('maps spawn rolls into the updated multiplayer archetype mix', () => {
    expect(rollNpcArchetype(0.10)).toBe('weak');
    expect(rollNpcArchetype(0.45)).toBe('standard');
    expect(rollNpcArchetype(0.75)).toBe('heavy');
    expect(rollNpcArchetype(0.95)).toBe('scavenger');
  });

  it('applies the weak archetype as a clearly softer variant of the standard ship', () => {
    const weakShip = createNpcBase(7);
    const standardShip = createNpcBase(8);

    applyNpcArchetype(weakShip, 'weak', 7, 0);
    applyNpcArchetype(standardShip, 'standard', 8, 0);

    expect(weakShip.name).toBe('Sloop');
    expect(weakShip.size).toBeLessThan(standardShip.size);
    expect(weakShip.mass).toBeLessThan(standardShip.mass);
    expect(weakShip.maxHp).toBeLessThan(standardShip.maxHp);
    expect(weakShip.baseSpeed).toBeLessThan(standardShip.baseSpeed);
    expect(weakShip.gunners).toBe(standardShip.gunners);
  });

  it('scales weak rewards below standard and heavy rewards above standard', () => {
    const weakReward = computeNpcReward('weak', 2, 0.2);
    const standardReward = computeNpcReward('standard', 2, 0.2);
    const heavyReward = computeNpcReward('heavy', 2, 0.2);

    expect(weakReward).toBeLessThan(standardReward);
    expect(heavyReward).toBeGreaterThan(standardReward);
  });
});