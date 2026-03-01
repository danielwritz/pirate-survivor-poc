import { describe, expect, it } from 'vitest';
import {
  autoInstallCannons,
  clampArmamentToHull,
  getWeaponCounts,
  normalizeWeaponLayout
} from '../src/core/armament.js';

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
});
