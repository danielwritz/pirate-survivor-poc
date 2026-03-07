/**
 * Fire Ship Boss — fast, aggressive ship that chases the highest-scoring player.
 * On ram collision: guaranteed fire ignition + 2× fire duration.
 * Self-destructs on ram, drops doubloons.
 *
 * Uses collision detection from shared/physics.js and fire system from shared/combat.js.
 */

import { createShip } from '../shared/shipState.js';
import { applyDamage } from '../shared/combat.js';
import {
  COLLISION_RADIUS_MUL,
  FIRE_DURATION_BASE,
  FIRE_TICK_INTERVAL,
  FIRE_SHIP_SPEED_MUL,
  FIRE_SHIP_SIZE_MUL,
  FIRE_SHIP_HP_BASE,
  FIRE_SHIP_RAM_DAMAGE,
  FIRE_SHIP_FIRE_DURATION_MUL,
  FIRE_SHIP_DOUBLOON_REWARD
} from '../shared/constants.js';

// ─── Factory ───

/**
 * Create a Fire Ship boss entity with scaled stats.
 *
 * @param {number} id              - Unique entity ID
 * @param {number} x               - Spawn x position
 * @param {number} y               - Spawn y position
 * @param {number} [tier=1]        - Boss tier (scales HP)
 * @param {number} [playerCount=1] - Active player count (scales HP)
 * @returns {object} Ship state object
 */
export function createFireShipBoss(id, x, y, tier = 1, playerCount = 1) {
  const ship = createShip(x, y, { id, name: 'Fire Ship', isNpc: true });

  ship.size      *= FIRE_SHIP_SIZE_MUL;
  ship.mass      *= FIRE_SHIP_SIZE_MUL;
  ship.baseSpeed *= FIRE_SHIP_SPEED_MUL;

  const scaledHp = FIRE_SHIP_HP_BASE + 15 * tier + 8 * playerCount;
  ship.maxHp = scaledHp;
  ship.hp    = scaledHp;

  ship.ram       = true;
  ship.ramDamage = FIRE_SHIP_RAM_DAMAGE;
  ship.isBoss    = true;
  ship.bossArchetype = 'fire_ship';

  ship.hullColor = '#8b2500';
  ship.trimColor = '#ff4500';
  ship.sailColor = '#ff6a00';

  ship._doubloonReward = FIRE_SHIP_DOUBLOON_REWARD + 5 * tier;
  ship.invulnTimer = 0;

  return ship;
}

// ─── Ram and ignite ───

/**
 * Apply Fire Ship ram effects to a target player ship.
 * Deals ram damage, guarantees fire ignition with 2× base duration,
 * and marks the boss as destroyed (self-destruct on ram).
 *
 * @param {object} boss   - Fire Ship boss entity
 * @param {object} player - Target player ship
 */
export function applyFireShipRam(boss, player) {
  // Apply ram damage through the shared combat pipeline (reduces HP, suppresses repair)
  applyDamage(player, boss.ramDamage || FIRE_SHIP_RAM_DAMAGE);

  // Guaranteed fire ignition with 2× base duration, regardless of chance roll
  player.onFire    = true;
  player.fireTimer = 0;
  player.fireTicks = Math.ceil(
    (FIRE_DURATION_BASE * FIRE_SHIP_FIRE_DURATION_MUL) / FIRE_TICK_INTERVAL
  );

  // Self-destruct
  boss.alive = false;
  boss.hp    = 0;
}

// ─── Target selection ───

function selectHighestScoringPlayer(playerShips) {
  const alive = playerShips.filter(p => p && p.alive);
  if (alive.length === 0) return null;
  let best = alive[0];
  for (const p of alive) {
    if ((p.doubloons || 0) > (best.doubloons || 0)) best = p;
  }
  return best;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ─── AI tick ───

/**
 * Tick the Fire Ship boss AI for one simulation step.
 * Beelines toward the highest-scoring player, detects ram collisions,
 * and applies ram-and-ignite on contact.
 *
 * Movement input is written to boss._input for the physics step upstream.
 *
 * @param {object}   boss        - Fire Ship boss entity
 * @param {Array}    playerShips - Array of live player ship objects
 * @param {object}   world       - { width, height }
 * @param {Array}    [islands]   - Island array (reserved for avoidance, currently unused)
 * @param {number}   dt          - Delta time in seconds
 * @param {function} [onRam]     - Optional callback(boss, player) invoked after ram
 */
export function tickFireShipBoss(boss, playerShips, world, islands, dt, onRam) {
  if (!boss.alive) return;

  const target = selectHighestScoringPlayer(playerShips);

  // Movement input — full-throttle beeline toward the target
  const input = {
    forward:  true,
    brake:    false,
    sailOpen: true,
    anchored: false,
    turn:     0
  };

  if (target) {
    const dx = target.x - boss.x;
    const dy = target.y - boss.y;
    const hd = angleDiff(Math.atan2(dy, dx), boss.heading);
    input.turn = Math.max(-1, Math.min(1, hd));
  }

  boss._input = input;

  // Collision detection using shared/physics.js COLLISION_RADIUS_MUL threshold
  for (const player of playerShips) {
    if (!player.alive) continue;
    const dx      = player.x - boss.x;
    const dy      = player.y - boss.y;
    const dist    = Math.hypot(dx, dy);
    const minDist = (boss.size || 16)   * COLLISION_RADIUS_MUL
                  + (player.size || 16) * COLLISION_RADIUS_MUL;

    if (dist < minDist) {
      applyFireShipRam(boss, player);
      if (onRam) onRam(boss, player);
      return; // boss destroyed — stop processing
    }
  }
}
