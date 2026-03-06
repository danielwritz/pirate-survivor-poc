import { describe, expect, it } from 'vitest';
import {
  autoInstallCannons,
  clampArmamentToHull,
  getWeaponCounts,
  normalizeWeaponLayout
} from '../src/core/armament.js';
import { getShipWeaponCaps } from '../src/core/shipMath.js';

describe('armament', () => {
  it('normalizes weapon layout to slot count', () => {
    const entity = {
      size: 16,
      hullLength: 1,
      hullBeam: 1,
      bowSharpness: 1,
      sternTaper: 1,
      weaponLayout: { port: ['gun'], starboard: [] }
    };

    const layout = normalizeWeaponLayout(entity);
    expect(layout.port.length).toBe(layout.starboard.length);
    expect(layout.port.length).toBeGreaterThanOrEqual(3);
  });

  it('auto-installs cannons and clamps to hull caps', () => {
    const entity = {
      size: 14,
      hullLength: 1,
      hullBeam: 1,
      bowSharpness: 1,
      sternTaper: 1,
      crew: 12,
      gunners: 12,
      cannonCapacityBonus: 0,
      weaponLayout: { port: [], starboard: [] }
    };

    normalizeWeaponLayout(entity);
    autoInstallCannons(entity, 4);
    const before = getWeaponCounts(entity);
    const caps = clampArmamentToHull(entity);
    const after = getWeaponCounts(entity);

    expect(before.cannonPerSide).toBeGreaterThan(0);
    expect(after.cannonPerSide).toBeLessThanOrEqual(caps.maxCannonsPerSide);
  });

  it('cannon rack bonus increases allowed cannons per side', () => {
    const base = {
      size: 14,
      hullLength: 1,
      hullBeam: 1,
      bowSharpness: 1,
      sternTaper: 1,
      crew: 12,
      gunners: 12,
      cannonCapacityBonus: 0,
      weaponLayout: { port: [], starboard: [] }
    };

    normalizeWeaponLayout(base);
    autoInstallCannons(base, 8);
    const baseCaps = clampArmamentToHull(base);
    const baseCounts = getWeaponCounts(base);

    const withRacks = {
      ...base,
      cannonCapacityBonus: 2,
      weaponLayout: {
        port: [...base.weaponLayout.port],
        starboard: [...base.weaponLayout.starboard]
      }
    };
    autoInstallCannons(withRacks, 8);
    const rackCaps = clampArmamentToHull(withRacks);
    const rackCounts = getWeaponCounts(withRacks);

    expect(rackCaps.maxCannonsPerSide).toBe(baseCaps.maxCannonsPerSide + 2);
    expect(rackCounts.cannonPerSide).toBeGreaterThanOrEqual(baseCounts.cannonPerSide);
    expect(rackCounts.cannonPerSide).toBeLessThanOrEqual(getShipWeaponCaps(withRacks, withRacks.cannonCapacityBonus).maxCannonsPerSide);
  });
});
