/**
 * Boss Director — spawns and manages boss NPCs on the server.
 *
 * Implements the Boss Director interface (Story 1 skeleton) and the
 * War Galleon archetype (Story 2).  Other archetypes (Fire Ship, Kraken)
 * are reserved for Stories 3 and 4.
 *
 * Boss state is stored in director.bosses (Map<id, {ship, aiState}>).
 * Each boss ship carries isBoss: true and bossArchetype: '<key>'.
 */

import { createShip } from '../shared/shipState.js';
import { syncArmamentDerivedStats } from '../src/core/armament.js';
import { forwardVector } from '../shared/physics.js';
import { fireCannonBroadside } from '../shared/combat.js';
import { getCannonRange } from '../shared/shipState.js';
import {
  BASE_SIZE, BASE_BULLET_SPEED,
  WAR_GALLEON_SIZE_MUL, WAR_GALLEON_CANNON_COUNT,
  WAR_GALLEON_BROADSIDE_INTERVAL, WAR_GALLEON_CANNON_DAMAGE,
  WAR_GALLEON_HP_PER_TIER, WAR_GALLEON_HP_PER_PLAYER
} from '../shared/constants.js';

let nextBossId = 90000;

// ─── Helpers ───

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI)  d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ─── War Galleon Archetype ───

/**
 * Configure a ship as a War Galleon boss.
 *
 * @param {object} ship        - Base ship created with createShip()
 * @param {number} tier        - Difficulty tier (1–8); scales HP
 * @param {number} playerCount - Active player count; scales HP
 * @returns {object} The configured ship (mutated in place)
 */
export function applyWarGalleonArchetype(ship, tier = 1, playerCount = 1) {
  ship.name         = 'War Galleon';
  ship.isBoss       = true;
  ship.bossArchetype = 'war_galleon';

  // Size: ~3× a level-10 player ship
  ship.size = BASE_SIZE * WAR_GALLEON_SIZE_MUL;
  ship.mass = ship.size * 4;

  // HP scales with tier and active player count
  const hp = WAR_GALLEON_HP_PER_TIER * tier + WAR_GALLEON_HP_PER_PLAYER * playerCount;
  ship.maxHp = hp;
  ship.hp    = hp;

  // Heavy cannonballs — higher damage than standard NPCs
  ship.bulletDamage = WAR_GALLEON_CANNON_DAMAGE;
  ship.bulletSpeed  = BASE_BULLET_SPEED;

  // 3 cannons per side (6 total).  Full cannonPivot so both sides always reach the target.
  const cannonsPerSide = WAR_GALLEON_CANNON_COUNT / 2;
  ship.weaponLayout = {
    port:      Array(cannonsPerSide).fill('cannon'),
    starboard: Array(cannonsPerSide).fill('cannon')
  };
  ship.cannonPivot  = 180;   // Full rotation — broadside can fire toward any bearing
  ship.cannonReload = 1.0;
  ship.gunners      = 12;

  // Initialise mount timers as fully charged so first broadside fires immediately
  ship.cannonMountTimers = {
    port:      Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL),
    starboard: Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL)
  };

  // Imposing dark warship colour scheme
  ship.hullColor = '#2a1f15';
  ship.trimColor = '#c8a050';
  ship.sailColor = '#8a0000';

  syncArmamentDerivedStats(ship);
  return ship;
}

// ─── War Galleon AI ───

/**
 * Fire all 6 cannons (both port and starboard) simultaneously toward aimAngle.
 * Reset all mount timers to BROADSIDE_INTERVAL so they are ready for the next volley.
 *
 * @param {object}   ship        - War Galleon ship
 * @param {number}   aimAngle    - World-space angle toward target
 * @param {function} spawnBullet - callback(bullet)
 * @returns {boolean} true if at least one cannon fired
 */
function fireMassiveBroadside(ship, aimAngle, spawnBullet) {
  const cannonsPerSide = WAR_GALLEON_CANNON_COUNT / 2;
  // Charge all mount timers so every cannon can fire now
  ship.cannonMountTimers.port      = Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL);
  ship.cannonMountTimers.starboard = Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL);

  // Fire both sides: War Galleon unleashes all 6 cannons at once
  const firedPort      = fireCannonBroadside(ship, 'port',      aimAngle, spawnBullet);
  const firedStarboard = fireCannonBroadside(ship, 'starboard', aimAngle, spawnBullet);
  return firedPort || firedStarboard;
}

/**
 * Tick AI for a single War Galleon boss.
 * Sails toward the nearest player cluster; fires a massive broadside every
 * WAR_GALLEON_BROADSIDE_INTERVAL seconds when in range.
 *
 * @param {{ ship: object, aiState: object }} boss
 * @param {object[]} playerShips  - Live player ship objects
 * @param {number}   dt           - Delta time (seconds)
 * @param {function} spawnBullet  - callback(bullet)
 * @param {object[]} events       - Mutable events array (may be null)
 */
function tickWarGalleonAi(boss, playerShips, dt, spawnBullet, events) {
  const ship = boss.ship;
  const ai   = boss.aiState;

  if (!ship.alive) return;

  const alive = (playerShips || []).filter(p => p && p.alive);
  const input = {
    forward: true, brake: false,
    turnLeft: false, turnRight: false,
    sailOpen: true, anchored: false
  };

  ai.broadsideTimer = (ai.broadsideTimer || 0) + dt;
  ai.modeTimer      = Math.max(0, (ai.modeTimer || 0) - dt);

  // Find centroid of the nearest cluster (up to 3 closest players)
  let targetX = null, targetY = null;
  if (alive.length > 0) {
    const sorted = [...alive].sort((a, b) =>
      Math.hypot(a.x - ship.x, a.y - ship.y) -
      Math.hypot(b.x - ship.x, b.y - ship.y)
    );
    const n  = Math.min(3, sorted.length);
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += sorted[i].x; cy += sorted[i].y; }
    targetX = cx / n;
    targetY = cy / n;
  }

  if (targetX !== null) {
    const dx           = targetX - ship.x;
    const dy           = targetY - ship.y;
    const dist         = Math.hypot(dx, dy);
    const angleToTarget = Math.atan2(dy, dx);
    const fwd          = forwardVector(ship.heading);
    const cannonRange  = getCannonRange(ship);

    // Transition from approach → broadside when player is in cannon range
    if (ai.mode !== 'broadside' && dist < cannonRange * 1.3) {
      ai.mode      = 'broadside';
      ai.modeTimer = 8;
    }

    switch (ai.mode) {
      case 'approach': {
        input.forward = true;
        const hdiff = angleDiff(angleToTarget, ship.heading);
        if (hdiff > 0.1)       input.turnRight = true;
        else if (hdiff < -0.1) input.turnLeft  = true;
        break;
      }

      case 'broadside': {
        // Steer to a perpendicular heading relative to the target
        const cross        = fwd.x * dy - fwd.y * dx;
        const perpHeading  = angleToTarget + (cross >= 0 ? -Math.PI / 2 : Math.PI / 2);
        const hdiff        = angleDiff(perpHeading, ship.heading);
        if (hdiff > 0.08)       input.turnRight = true;
        else if (hdiff < -0.08) input.turnLeft  = true;

        if (dist < cannonRange * 0.5)      input.brake   = true;
        else if (dist > cannonRange * 1.1) input.forward = true;
        else                               input.forward  = false;

        // Fire massive broadside when timer is charged and target is in range
        if (ai.broadsideTimer >= WAR_GALLEON_BROADSIDE_INTERVAL && dist < cannonRange) {
          const firedAny = fireMassiveBroadside(ship, angleToTarget, spawnBullet);
          if (firedAny) {
            ai.broadsideTimer = 0;
            if (events) {
              events.push({
                type:     'bossBroadside',
                bossId:   ship.id,
                bossType: 'war_galleon',
                x: ship.x, y: ship.y
              });
            }
          }
        }

        // Return to approach when target escapes range or mode expires
        if (dist > cannonRange * 1.5 || ai.modeTimer <= 0) {
          ai.mode      = 'approach';
          ai.modeTimer = 0;
        }
        break;
      }

      default:
        ai.mode = 'approach';
    }
  }

  ship._input = input;
}

// ─── Director Lifecycle ───

/**
 * Create a new boss director instance.
 * @returns {{ bosses: Map }}
 */
export function createBossDirector() {
  return {
    bosses: new Map()
  };
}

/**
 * Spawn a boss of the given archetype into the director.
 *
 * @param {object}              director    - Boss director
 * @param {string}              archetype   - 'war_galleon' (others reserved)
 * @param {number}              tier        - Difficulty tier
 * @param {number}              playerCount - Active player count
 * @param {{ x: number, y: number }} position - Spawn position
 * @returns {number} Assigned boss ID
 */
export function spawnBoss(director, archetype, tier, playerCount, position) {
  const id   = nextBossId++;
  const ship = createShip(position.x, position.y, { id, name: 'Boss', isNpc: true });

  if (archetype === 'war_galleon') {
    applyWarGalleonArchetype(ship, tier, playerCount);
  }

  const aiState = {
    mode:          'approach',
    modeTimer:     0,
    broadsideTimer: 0,
    lastX:         position.x,
    lastY:         position.y
  };

  director.bosses.set(id, { ship, aiState });
  return id;
}

/**
 * Remove a boss from the director (e.g. on death).
 * @param {object} director
 * @param {number} bossId
 */
export function removeBoss(director, bossId) {
  director.bosses.delete(bossId);
}

/**
 * Tick all boss AIs.  Called each simulation frame.
 *
 * @param {object}   director    - Boss director
 * @param {object[]} playerShips - Live player ship objects
 * @param {number}   dt          - Delta time (seconds)
 * @param {function} spawnBullet - callback(bullet)
 * @param {object[]} events      - Mutable events array
 */
export function tickBossDirector(director, playerShips, dt, spawnBullet, events) {
  for (const [, boss] of director.bosses) {
    if (!boss.ship.alive) continue;

    switch (boss.ship.bossArchetype) {
      case 'war_galleon':
        tickWarGalleonAi(boss, playerShips, dt, spawnBullet, events);
        break;
      // Future: 'fire_ship', 'kraken'
    }
  }
}

/**
 * Return all boss ship objects (for use in collision / bullet systems).
 * @param {object} director
 * @returns {object[]}
 */
export function getBossShips(director) {
  const ships = [];
  for (const [, boss] of director.bosses) ships.push(boss.ship);
  return ships;
}
