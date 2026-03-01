import { describe, expect, it } from 'vitest';
import { getDeckCrewCapacity, getShipTier, getShipWeaponCaps, hullHalfWidthAt } from '../src/core/shipMath.js';

describe('shipMath', () => {
  const ship = {
    size: 18,
    hullLength: 1,
    hullBeam: 1,
    bowSharpness: 1,
    sternTaper: 1
  };

  it('computes tier and armament caps from hull shape', () => {
    const tier = getShipTier(ship);
    const caps = getShipWeaponCaps(ship, 1);
    expect(tier).toBeGreaterThanOrEqual(1);
    expect(caps.maxCannonsPerSide).toBeGreaterThanOrEqual(3);
    expect(caps.maxGunners).toBeGreaterThan(0);
  });

  it('computes positive deck crew capacity', () => {
    const capacity = getDeckCrewCapacity(ship);
    expect(capacity).toBeGreaterThanOrEqual(2);
  });

  it('returns valid half width along hull axis', () => {
    const caps = getShipWeaponCaps(ship, 0);
    expect(caps.tier).toBeGreaterThan(0);
    const width = hullHalfWidthAt({
      bowX: 15,
      shoulderX: 8,
      shoulderHalfBeam: 6,
      sternShoulderX: -8,
      sternHalfBeam: 4,
      sternX: -13
    }, 0);
    expect(width).toBeGreaterThan(0);
  });
});
