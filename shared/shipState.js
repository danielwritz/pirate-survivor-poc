/**
 * Ship-as-JSON — canonical ship state schema, factory, and derived-stat calculator.
 * Runs on both server and client. No DOM/canvas deps.
 *
 * Every ship (player or NPC) is a flat JSON object. Upgrades are modifiers that
 * mutate fields on this object. The server is the source of truth; clients
 * receive a snapshot each tick.
 */

import { clamp } from '../src/core/math.js';
import {
  BASE_SPEED, BASE_MASS, BASE_SIZE, BASE_HP, BASE_GUN_RELOAD,
  BASE_CANNON_RELOAD, BASE_BULLET_DAMAGE, BASE_BULLET_SPEED,
  BASE_RAM_DAMAGE, STARTING_CREW, STARTING_GUNNERS,
  GUN_RANGE_BASE, GUN_RANGE_PER_GUN, GUN_RANGE_PER_GUNNER, GUN_RANGE_PER_LEVEL,
  CANNON_RANGE_BASE, CANNON_RANGE_PER_CANNON, CANNON_RANGE_PER_PIVOT,
  CANNON_RANGE_PER_LEVEL, CANNON_RANGE_MIN_OVER_GUN,
  WEAPON_DEMAND_PER_GUN, WEAPON_DEMAND_PER_CANNON,
  CREW_EFFICIENCY_A, CREW_EFFICIENCY_B, CREW_EFFICIENCY_MIN, CREW_EFFICIENCY_MAX,
  VISION_BASE_OFFSET, VISION_MIN, VISION_MAX,
  REPAIR_RATE_BASE, REPAIR_RATE_PER_CREW,
  RESPAWN_INVULN
} from './constants.js';

// Re-export hull shape + weapon cap utilities from existing modules
// (these are pure math, safe for both environments)
export { getHullShape, getShipTier, getShipWeaponCaps, getDeckCrewCapacity, getHullSideMount, hullHalfWidthAt } from '../src/core/shipMath.js';
export { getWeaponSlotCount, normalizeWeaponLayout, getWeaponCounts, syncArmamentDerivedStats, clampArmamentToHull, autoInstallCannons, autoInstallGuns, getWeaponCrewDemand, getWeaponCrewRatio, getEffectiveReloadTimes } from '../src/core/armament.js';

// ─── Ship factory ───

/**
 * Create a new ship with default starter values.
 * Used for both players and NPCs (NPCs then get upgrades applied).
 */
export function createShip(x = 0, y = 0, opts = {}) {
  return {
    // Identity (set by caller)
    id: opts.id ?? 0,
    name: opts.name ?? '',
    isNpc: opts.isNpc ?? false,

    // Position / motion
    x,
    y,
    heading: opts.heading ?? -Math.PI / 2,
    speed: 0,

    // Core stats (baseline — upgrades modify these)
    size: BASE_SIZE,
    mass: BASE_MASS,
    baseSpeed: BASE_SPEED,
    maxHp: BASE_HP,
    hp: BASE_HP,
    gunReload: BASE_GUN_RELOAD,
    cannonReload: BASE_CANNON_RELOAD,
    bulletDamage: BASE_BULLET_DAMAGE,
    bulletSpeed: BASE_BULLET_SPEED,
    rudder: 0,
    maneuverPenalty: 0,

    // Crew
    crew: STARTING_CREW,
    rowers: 0,
    gunners: STARTING_GUNNERS,
    repairCrew: 0,

    // Armament
    cannonCapacityBonus: 0,
    cannonPivot: 0,
    cannons: 0,       // derived — cannon count per side (synced by armament)
    weaponLayout: { port: [], starboard: [] },

    // Hull shape multipliers (upgrades tweak these)
    hullLength: 1,
    hullBeam: 1,
    bowSharpness: 1,
    sternTaper: 1,

    // Visuals
    hullColor: '#5f4630',
    trimColor: '#d9b78d',
    sailColor: '#f0f7ff',
    mastScale: 1,
    hullArmorTier: 0,
    sailOpen: true,

    // Movement
    anchorDropped: false,

    // Combat flags
    ram: false,
    ramDamage: BASE_RAM_DAMAGE,

    // Vision
    lookoutRangeBonus: 0,

    // Upgrade tracking (ordered list of applied upgrade IDs)
    upgrades: [],
    slots: [],       // ability labels (max 4)

    // Transient state (server-managed)
    alive: true,
    invulnTimer: RESPAWN_INVULN,
    impactTimer: 0,
    repairSuppressed: 0,
    gunTimer: BASE_GUN_RELOAD,      // start ready to fire
    cannonTimer: BASE_CANNON_RELOAD,
    cannonVolleyTimer: 0,            // per-side volley cooldown
    onFire: false,
    fireTimer: 0,
    fireTicks: 0,

    // Economy (players only — ignored for NPCs)
    doubloons: 0,
    kills: 0,
    playerKills: 0,
    deaths: 0,
    level: 1,
    xp: 0,
    xpToNext: 10,

    // Pending upgrade offer (null or array of 3 upgrade objects)
    upgradeOffer: null,
    pendingLevelUpOffers: 0,
    pendingMajorOffers: 0
  };
}

// ─── Derived stat calculators ───

/**
 * Compute the gun range for a ship, given its current stats.
 */
export function getGunRange(ship) {
  const wc = _weaponCounts(ship);
  return GUN_RANGE_BASE
    + wc.gunTotal * GUN_RANGE_PER_GUN
    + (ship.gunners || 0) * GUN_RANGE_PER_GUNNER
    + (ship.level || 1) * GUN_RANGE_PER_LEVEL;
}

/**
 * Compute the cannon range for a ship.
 */
export function getCannonRange(ship) {
  const gunRange = getGunRange(ship);
  const wc = _weaponCounts(ship);
  const raw = CANNON_RANGE_BASE
    + wc.cannonPerSide * CANNON_RANGE_PER_CANNON
    + (ship.cannonPivot || 0) * CANNON_RANGE_PER_PIVOT
    + (ship.level || 1) * CANNON_RANGE_PER_LEVEL;
  return Math.max(gunRange + CANNON_RANGE_MIN_OVER_GUN, raw);
}

/** Inline weapon count from layout (avoids circular import issues). */
function _weaponCounts(ship) {
  const layout = ship.weaponLayout || { port: [], starboard: [] };
  let gunTotal = 0, cannonTotal = 0, portCannons = 0, starCannons = 0;
  for (const slot of layout.port) {
    if (slot === 'gun') gunTotal++;
    else if (slot === 'cannon') { cannonTotal++; portCannons++; }
  }
  for (const slot of layout.starboard) {
    if (slot === 'gun') gunTotal++;
    else if (slot === 'cannon') { cannonTotal++; starCannons++; }
  }
  return { gunTotal, cannonTotal, cannonPerSide: Math.max(portCannons, starCannons) };
}

/**
 * Compute vision range for fog-of-war.
 */
export function getVisionRange(ship) {
  const cannonRange = getCannonRange(ship);
  return clamp(
    cannonRange + VISION_BASE_OFFSET + (ship.lookoutRangeBonus || 0),
    VISION_MIN,
    VISION_MAX
  );
}

/**
 * Compute passive repair rate for the ship.
 */
export function getRepairRate(ship) {
  return REPAIR_RATE_BASE + (ship.repairCrew || 0) * REPAIR_RATE_PER_CREW;
}

/**
 * Get weapon crew efficiency factor (affects reload speed).
 */
export function getCrewEfficiency(ship) {
  const wc = _weaponCounts(ship);
  const demand = Math.max(1, wc.gunTotal * WEAPON_DEMAND_PER_GUN + wc.cannonTotal * WEAPON_DEMAND_PER_CANNON);
  const ratio = clamp((ship.gunners || 0) / demand, 0.25, 1.55);
  return clamp(CREW_EFFICIENCY_A - ratio * CREW_EFFICIENCY_B, CREW_EFFICIENCY_MIN, CREW_EFFICIENCY_MAX);
}

// ─── Snapshot for network ───

/**
 * Produce a minimal JSON snapshot of a ship for sending to clients.
 * Strips transient server-only fields, rounds floats.
 */
export function shipSnapshot(ship) {
  const r1 = v => Math.round(v * 10) / 10;
  const r2 = v => Math.round(v * 100) / 100;
  const r3 = v => Math.round(v * 1000) / 1000;

  return {
    id: ship.id,
    name: ship.name,
    isNpc: ship.isNpc,

    x: r2(ship.x),
    y: r2(ship.y),
    heading: r3(ship.heading),
    speed: r2(ship.speed),

    size: r1(ship.size),
    mass: r1(ship.mass),
    maxHp: r1(ship.maxHp),
    hp: r1(ship.hp),
    alive: ship.alive,
    invuln: (ship.invulnTimer || 0) > 0,

    // Hull shape
    hullLength: r2(ship.hullLength),
    hullBeam: r2(ship.hullBeam),
    bowSharpness: r2(ship.bowSharpness),
    sternTaper: r2(ship.sternTaper),

    // Visuals
    hullColor: ship.hullColor,
    trimColor: ship.trimColor,
    sailColor: ship.sailColor,
    mastScale: r2(ship.mastScale),
    hullArmorTier: ship.hullArmorTier,
    sailOpen: ship.sailOpen,

    // Weapons (full layout for client rendering)
    weaponLayout: ship.weaponLayout,
    cannonPivot: ship.cannonPivot,

    // Combat state
    onFire: ship.onFire,
    anchorDropped: !!ship.anchorDropped,
    ram: ship.ram,
    ramDamage: ship.ramDamage,
    burnTime: r1(ship.fireTimer || 0),

    // Reload timers (for HUD bars)
    gunTimer: r2(ship.gunTimer || 0),
    cannonTimer: r2(ship.cannonTimer || 0),
    gunReload: r2(ship.gunReload),
    cannonReload: r2(ship.cannonReload),
    baseSpeed: r2(ship.baseSpeed),

    // Crew (for HUD display)
    crew: ship.crew,
    rowers: ship.rowers,
    gunners: ship.gunners,
    repairCrew: ship.repairCrew,
    rudder: ship.rudder,

    // Flag / pennant (NPC visuals)
    flagColor: ship.flagColor || null,
    flagAccent: ship.flagAccent || null,
    flagStripes: ship.flagStripes || 0,

    // Economy
    doubloons: Math.floor(ship.doubloons),
    kills: ship.kills,
    playerKills: ship.playerKills || 0,
    deaths: ship.deaths,
    level: ship.level,
    xp: Math.floor(ship.xp || 0),
    xpToNext: Math.max(1, Math.floor(ship.xpToNext || 10)),

    // Vision
    lookoutRangeBonus: ship.lookoutRangeBonus,

    // Upgrades applied
    upgrades: ship.upgrades
  };
}
