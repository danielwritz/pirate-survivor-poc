/**
 * World Manager — server-side island/building state management.
 * Handles building damage, destruction gold drops, tower firing, and island collisions.
 */

import { generateWorld, setDefenseTier, getTowerStats, getIslandContact, worldSnapshot } from '../shared/world.js';
import { createRng } from '../shared/world.js';
import {
  BUILDING_DMG_CANNON_SCALE, BUILDING_DMG_GUN_SCALE, BUILDING_GOLD_MIN,
  ISLAND_CONTACT_SPEED_MUL, ISLAND_CONTACT_DMG_BASE, ISLAND_CONTACT_DMG_MASS
} from '../shared/constants.js';

/**
 * Create world state for a new round.
 * @param {number} seed - Random seed
 * @returns {object} - World state
 */
export function createWorldState(seed, roundConfig = null) {
  const world = generateWorld(seed, roundConfig || undefined);
  world.defenseTier = 0;
  world.defenseRng = createRng(seed + 777);
  return world;
}

/**
 * Apply bullet damage to buildings. Returns gold drops to create.
 *
 * @param {object} worldState
 * @param {object} bullet     - { x, y, heavy, dmg }
 * @returns {Array} - Array of { x, y, value } gold drops from destroyed buildings
 */
// Minimum distance from point P to line segment AB
function pointToSegmentDist(px, py, ax, ay, bx2, by2) {
  const dx = bx2 - ax, dy = by2 - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function damageBuildingAtPoint(worldState, bx, by, dmg, isHeavy, prevBx, prevBy) {
  const drops = [];
  const swept = prevBx !== undefined && prevBy !== undefined;

  for (const island of worldState.islands) {
    for (const b of island.buildings) {
      if (b.destroyed) continue;

      // Swept segment-circle test (catches fast cannonballs that tunnel through)
      const hitScale = b.isTower ? 1 : 3;
      const hitRadius = b.size * hitScale + 6;
      const d = swept
        ? pointToSegmentDist(b.x, b.y, prevBx, prevBy, bx, by)
        : Math.hypot(b.x - bx, b.y - by);
      if (d > hitRadius) continue;

      // Apply damage with weapon-type scaling
      const scale = isHeavy ? BUILDING_DMG_CANNON_SCALE : BUILDING_DMG_GUN_SCALE;
      b.hp -= dmg * scale;

      if (b.hp <= 0) {
        b.destroyed = true;
        b.hp = 0;

        // Gold drops from destruction
        const goldValue = BUILDING_GOLD_MIN + Math.floor(b.size * 0.5) + Math.floor(Math.random() * 3);
        const dropCount = 2 + Math.floor(Math.random() * 3);
        const perDrop = goldValue / dropCount;

        for (let i = 0; i < dropCount; i++) {
          const angle = (Math.PI * 2 * i) / dropCount + Math.random() * 0.5;
          const dist = 10 + Math.random() * 20;
          drops.push({
            x: b.x + Math.cos(angle) * dist,
            y: b.y + Math.sin(angle) * dist,
            value: Math.round(perDrop),
            vx: Math.cos(angle) * 0.5,
            vy: Math.sin(angle) * 0.5,
            age: 0
          });
        }
      }
    }
  }

  return drops;
}

/**
 * Tick tower firing against nearby ships.
 *
 * @param {object} worldState
 * @param {Array} ships        - All ships (players + NPCs) as array
 * @param {number} defenseLevel
 * @param {number} dt
 * @param {function} spawnBullet - callback(bullet)
 */
export function tickTowers(worldState, ships, defenseLevel, dt, spawnBullet) {
  const stats = getTowerStats(defenseLevel);

  for (const island of worldState.islands) {
    for (const b of island.buildings) {
      if (b.destroyed || !b.isTower) continue;

      b.towerTimer = (b.towerTimer || 0) + dt;
      if (b.towerTimer < stats.fireRate) continue;

      // Find nearest ship in range
      let nearest = null;
      let nearestDist = Infinity;
      for (const ship of ships) {
        if (!ship.alive) continue;
        const d = Math.hypot(ship.x - b.x, ship.y - b.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = ship;
        }
      }

      // Fire at nearest ship within reasonable range (~cannonRange)
      const maxRange = 300 + defenseLevel * 20;
      if (!nearest || nearestDist > maxRange) continue;

      b.towerTimer = 0;

      // Spawn tower bullet
      const angle = Math.atan2(nearest.y - b.y, nearest.x - b.x) + (Math.random() - 0.5) * 0.08;
      spawnBullet({
        x: b.x,
        y: b.y,
        vx: Math.cos(angle) * 5.5,
        vy: Math.sin(angle) * 5.5,
        dmg: stats.damage,
        heavy: true,
        ownerId: -1,          // No owner (tower)
        ownerIsNpc: true,
        travel: 0,
        maxRange: maxRange
      });
    }
  }
}

/**
 * Apply island contact effects to a ship.
 * @param {object} ship
 * @param {object} worldState
 * @param {number} dt
 * @returns {number} - damage dealt (0 if no contact)
 */
export function applyIslandContact(ship, worldState, dt) {
  const island = getIslandContact(ship, worldState.islands);
  if (!island) return 0;

  // Slow the ship
  ship.speed *= ISLAND_CONTACT_SPEED_MUL;

  // Push away from island center
  const dx = ship.x - island.x;
  const dy = ship.y - island.y;
  const d = Math.hypot(dx, dy) || 1;
  const pushDist = 1.5 * dt * 60;
  ship.x += (dx / d) * pushDist;
  ship.y += (dy / d) * pushDist;

  // Contact damage
  const dmg = (ISLAND_CONTACT_DMG_BASE + (ship.mass || 28) * ISLAND_CONTACT_DMG_MASS) * dt * 0.5;
  return dmg;
}

/**
 * Update defense tier based on round time.
 */
export function updateDefenseTier(worldState, roundTime) {
  const newTier = Math.floor(roundTime / 90); // escalate every 90 seconds
  if (newTier !== worldState.defenseTier) {
    worldState.defenseTier = newTier;
    setDefenseTier(worldState.islands, newTier, worldState.defenseRng);
  }
}

/**
 * Get world snapshot for network sync.
 */
export function getWorldSnapshot(worldState) {
  return worldSnapshot(worldState);
}
