/**
 * Shared world generation — procedural islands with buildings, docks, and towers.
 * Seeded RNG so server + client generate identically from the same seed.
 * No DOM/canvas deps.
 */

import { clamp } from '../src/core/math.js';
import {
  ISLAND_COUNT, WORLD_WIDTH, WORLD_HEIGHT,
  BUILDING_HP_BASE, BUILDING_HP_SIZE_MUL,
  TOWER_CHANCE_BASE, TOWER_CHANCE_PER_TIER, TOWER_CHANCE_MAX,
  TOWER_FIRE_RATE_BASE, TOWER_FIRE_RATE_MIN, TOWER_FIRE_RATE_PER_LEVEL,
  TOWER_DMG_BASE, TOWER_DMG_PER_LEVEL
} from './constants.js';

// ─── Seeded RNG (mulberry32) ───

export function createRng(seed) {
  let s = seed | 0;
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── Island generation ───

/**
 * Generate the full world state (islands, buildings, docks) from a seed.
 * Both server and client call this with the same seed to get the same world.
 *
 * @param {number} seed - Random seed for this round
 * @returns {object} - { islands: [...], seed }
 */
export function generateWorld(seed) {
  const rng = createRng(seed);
  const islands = [];

  // Place islands with spacing
  const margin = 200;
  const minSpacing = 280;
  const attempts = ISLAND_COUNT * 8;

  for (let a = 0; a < attempts && islands.length < ISLAND_COUNT; a++) {
    const x = margin + rng() * (WORLD_WIDTH - margin * 2);
    const y = margin + rng() * (WORLD_HEIGHT - margin * 2);

    // Check spacing
    let tooClose = false;
    for (const existing of islands) {
      const d = Math.hypot(existing.x - x, existing.y - y);
      if (d < minSpacing) { tooClose = true; break; }
    }
    if (tooClose) continue;

    // Size class
    const sizeRoll = rng();
    let radius;
    if (sizeRoll < 0.5) radius = 28 + rng() * 36;           // small
    else if (sizeRoll < 0.85) radius = 50 + rng() * 76;     // medium
    else radius = 96 + rng() * 82;                           // large

    const island = createIsland(islands.length, x, y, radius, rng);
    islands.push(island);
  }

  return { islands, seed };
}

function createIsland(id, x, y, radius, rng) {
  // Generate irregular outline (8-12 points around center)
  const pointCount = 8 + Math.floor(rng() * 5);
  const outline = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (Math.PI * 2 * i) / pointCount + (rng() - 0.5) * 0.4;
    const r = radius * (0.7 + rng() * 0.5);
    outline.push({
      x: x + Math.cos(angle) * r,
      y: y + Math.sin(angle) * r
    });
  }

  // Buildings (2+ based on radius)
  const buildingCount = Math.max(2, Math.floor(radius / 30) + Math.floor(rng() * 3));
  const buildings = [];
  for (let i = 0; i < buildingCount; i++) {
    const bAngle = rng() * Math.PI * 2;
    const bDist = rng() * radius * 0.65;
    const bSize = 8 + rng() * 18;
    buildings.push({
      id: `${id}-b${i}`,
      x: x + Math.cos(bAngle) * bDist,
      y: y + Math.sin(bAngle) * bDist,
      size: bSize,
      maxHp: BUILDING_HP_BASE + bSize * BUILDING_HP_SIZE_MUL,
      hp: BUILDING_HP_BASE + bSize * BUILDING_HP_SIZE_MUL,
      destroyed: false,
      isTower: false,      // assigned later by setDefenseTier
      towerTimer: 0
    });
  }

  // Docks (1-3)
  const dockCount = 1 + Math.floor(rng() * 2.5);
  const docks = [];
  for (let i = 0; i < dockCount; i++) {
    const dAngle = rng() * Math.PI * 2;
    const dLen = 20 + rng() * 30;
    docks.push({
      x: x + Math.cos(dAngle) * radius,
      y: y + Math.sin(dAngle) * radius,
      angle: dAngle,
      length: dLen
    });
  }

  return {
    id,
    x, y,
    radius,
    outline,
    buildings,
    docks,
    foliageSeeds: Array.from({ length: 3 + Math.floor(rng() * 5) }, () => ({
      x: x + (rng() - 0.5) * radius * 1.2,
      y: y + (rng() - 0.5) * radius * 1.2,
      size: 4 + rng() * 10,
      type: rng() < 0.7 ? 'tree' : 'shrub'
    }))
  };
}

// ─── Defense tier ───

/**
 * Set island defense tier: decides which buildings become towers.
 * Called when difficulty changes (periodically as round progresses).
 *
 * @param {Array} islands     - World islands array
 * @param {number} defenseTier - Current difficulty tier (0+)
 * @param {function} rng      - Seeded rng (or Math.random)
 */
export function setDefenseTier(islands, defenseTier, rng = Math.random) {
  const towerChance = clamp(
    TOWER_CHANCE_BASE + defenseTier * TOWER_CHANCE_PER_TIER,
    0,
    TOWER_CHANCE_MAX
  );

  for (const island of islands) {
    for (const b of island.buildings) {
      if (b.destroyed) continue;
      b.isTower = rng() < towerChance;
    }
  }
}

/**
 * Get tower fire parameters for the current defense level.
 */
export function getTowerStats(defenseLevel) {
  return {
    fireRate: Math.max(TOWER_FIRE_RATE_MIN, TOWER_FIRE_RATE_BASE - defenseLevel * TOWER_FIRE_RATE_PER_LEVEL),
    damage: TOWER_DMG_BASE + defenseLevel * TOWER_DMG_PER_LEVEL
  };
}

// ─── Island collision check ───

/**
 * Check if a point is inside an island (simple circle check for now).
 * @param {number} px
 * @param {number} py
 * @param {object} island
 * @returns {boolean}
 */
export function isPointOnIsland(px, py, island) {
  const d = Math.hypot(px - island.x, py - island.y);
  return d < island.radius * 0.85;  // slightly smaller than outline for gameplay
}

/**
 * Check all islands for a ship contact.
 * @param {object} ship
 * @param {Array} islands
 * @returns {object|null} - island if touching, null otherwise
 */
export function getIslandContact(ship, islands) {
  for (const island of islands) {
    const d = Math.hypot(ship.x - island.x, ship.y - island.y);
    if (d < island.radius * 0.85 + (ship.size || 16) * 0.5) {
      return island;
    }
  }
  return null;
}

// ─── World snapshot for network ───

/**
 * Produce a minimal snapshot of world state for sending to clients.
 * Islands are generated identically on client from seed, but building HP/destroyed
 * state must be synced.
 */
export function worldSnapshot(worldState) {
  return {
    seed: worldState.seed,
    buildings: worldState.islands.flatMap(island =>
      island.buildings.map(b => ({
        id: b.id,
        hp: Math.round(b.hp * 10) / 10,
        maxHp: b.maxHp,
        destroyed: b.destroyed,
        isTower: b.isTower
      }))
    )
  };
}
