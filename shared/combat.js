/**
 * Shared combat system — mount-level broadside, bullets, damage, fire/ignition.
 * Runs on server (authoritative). Pure logic, no DOM/canvas deps.
 *
 * Design: Ships have a weaponLayout with per-slot gun/cannon/empty.
 * Guns auto-fire at nearest enemy in range+arc. Cannons fire on player command
 * (aim angle from client) or auto-fire for NPCs.
 */

import { clamp } from '../src/core/math.js';
import { getHullShape, getHullSideMount } from '../src/core/shipMath.js';
import {
  GUN_PIVOT_RAD, GUN_SPREAD,
  BULLET_SPEED_GUN_BONUS, BULLET_SPEED_CANNON_BONUS,
  CANNON_DMG_BONUS, CANNON_SPREAD,
  INCOMING_DMG_SCALE_GUN, INCOMING_DMG_SCALE_CANNON,
  FIRE_CHANCE_BASE, FIRE_CHANCE_PER_DMG,
  FIRE_TICK_INTERVAL, FIRE_DMG_PLAYER, FIRE_DMG_ENEMY,
  FIRE_DURATION_BASE,
  REPAIR_SUPPRESS_TIME,
  REPAIR_RATE_BASE, REPAIR_RATE_PER_CREW
} from './constants.js';
import { forwardVector } from './physics.js';
import { getGunRange, getCannonRange, getCrewEfficiency } from './shipState.js';

// ─── Helpers ───

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const SIDE_KEYS = ['port', 'starboard'];

function ensureMountTimerLanes(ship, timerKey, fallbackValue = 0) {
  if (!ship[timerKey] || typeof ship[timerKey] !== 'object') {
    ship[timerKey] = { port: [], starboard: [] };
  }
  const layout = ship.weaponLayout || { port: [], starboard: [] };
  for (const side of SIDE_KEYS) {
    const slots = layout[side] || [];
    const oldLane = Array.isArray(ship[timerKey][side]) ? ship[timerKey][side] : [];
    const nextLane = new Array(slots.length);
    for (let i = 0; i < slots.length; i++) {
      const prior = oldLane[i];
      nextLane[i] = Number.isFinite(prior) ? Math.max(0, prior) : Math.max(0, fallbackValue);
    }
    ship[timerKey][side] = nextLane;
  }
  return ship[timerKey];
}

function ensureMountTimers(ship) {
  const gunFallback = Number.isFinite(ship.gunTimer) ? ship.gunTimer : (ship.gunReload || 0);
  const cannonFallback = Number.isFinite(ship.cannonTimer) ? ship.cannonTimer : (ship.cannonReload || 0);
  const gunMountTimers = ensureMountTimerLanes(ship, 'gunMountTimers', gunFallback);
  const cannonMountTimers = ensureMountTimerLanes(ship, 'cannonMountTimers', cannonFallback);
  return { gunMountTimers, cannonMountTimers };
}

function advanceTimerLanes(timerLanes, dt) {
  for (const side of SIDE_KEYS) {
    const lane = timerLanes[side] || [];
    for (let i = 0; i < lane.length; i++) lane[i] += dt;
  }
}

function getLegacyTimerFromMountLanes(ship, timerLanes, slotType) {
  const layout = ship.weaponLayout || { port: [], starboard: [] };
  let best = 0;
  let foundAny = false;
  for (const side of SIDE_KEYS) {
    const slots = layout[side] || [];
    const lane = timerLanes[side] || [];
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] !== slotType) continue;
      foundAny = true;
      best = Math.max(best, lane[i] || 0);
    }
  }
  return foundAny ? best : 0;
}

function getMountFacingAngle(ship, mount) {
  const cos = Math.cos(ship.heading);
  const sin = Math.sin(ship.heading);
  const worldNx = mount.nx * cos - mount.ny * sin;
  const worldNy = mount.nx * sin + mount.ny * cos;
  return Math.atan2(worldNy, worldNx);
}

function getMountAimAngle(mountFacingAngle, aimAngle, pivotRad) {
  if (!Number.isFinite(aimAngle)) return null;
  const offset = angleDiff(aimAngle, mountFacingAngle);
  if (Math.abs(offset) > pivotRad) return null;
  return normalizeAngle(mountFacingAngle + offset);
}

// ─── Gun auto-fire ───

/**
 * Process gun auto-fire for a single ship.
 * Finds nearest enemy in range, fires guns on matching side if broadside angle allows.
 *
 * @param {object} ship      - Firing ship
 * @param {Array}  targets   - Array of { ship, id } (potential targets)
 * @param {number} dt        - Delta time
 * @param {function} spawnBullet - callback(bullet) to add bullet to world
 */
export function tickGunAutoFire(ship, targets, dt, spawnBullet) {
  if (!ship.alive) return;

  const layout = ship.weaponLayout || { port: [], starboard: [] };
  const shape = getHullShape(ship);
  const { gunMountTimers } = ensureMountTimers(ship);
  const gunRange = getGunRange(ship);
  const efficiency = getCrewEfficiency(ship);
  const effectiveReload = (ship.gunReload || 1.35) * efficiency;
  const fireArc = GUN_PIVOT_RAD + 0.08;

  let firedAny = false;
  for (const sideKey of SIDE_KEYS) {
    const sideSign = sideKey === 'starboard' ? 1 : -1;
    const lane = layout[sideKey] || [];
    const timerLane = gunMountTimers[sideKey] || [];
    const totalSlots = lane.length;

    for (let i = 0; i < totalSlots; i++) {
      if (lane[i] !== 'gun') continue;
      if ((timerLane[i] || 0) < effectiveReload) continue;

      const mount = getHullSideMount(shape, i, totalSlots, sideSign);
      const mountFacingAngle = getMountFacingAngle(ship, mount);
      let nearest = null;
      let nearestDist = Infinity;

      for (const t of targets) {
        if (!t.ship.alive) continue;
        const dx = t.ship.x - ship.x;
        const dy = t.ship.y - ship.y;
        const dist = Math.hypot(dx, dy);
        if (dist > gunRange || dist >= nearestDist) continue;
        const toTargetAngle = Math.atan2(dy, dx);
        if (Math.abs(angleDiff(toTargetAngle, mountFacingAngle)) > fireArc) continue;
        nearest = t;
        nearestDist = dist;
      }

      if (!nearest) continue;

      const cos = Math.cos(ship.heading);
      const sin = Math.sin(ship.heading);
      const GUN_BARREL_LEN = 7.2;
      const tipX = mount.x + mount.nx * GUN_BARREL_LEN;
      const tipY = mount.y + mount.ny * GUN_BARREL_LEN;
      const worldX = ship.x + tipX * cos - tipY * sin;
      const worldY = ship.y + tipX * sin + tipY * cos;

      // Fire 2-3 musket balls along this mount's own line-of-fire.
      const ballCount = Math.random() < 0.45 ? 3 : 2;
      const spreadHalf = GUN_SPREAD * 1.4;
      const baseDmg = (ship.bulletDamage || 9) * 0.65;
      const speed = (ship.bulletSpeed || 6) + BULLET_SPEED_GUN_BONUS;

      for (let b = 0; b < ballCount; b++) {
        const t = ballCount === 1 ? 0 : (b / (ballCount - 1)) - 0.5;
        const jitter = (Math.random() - 0.5) * GUN_SPREAD * 0.3;
        const shotAngle = mountFacingAngle + t * spreadHalf * 2 + jitter;
        const ballSpeed = speed * (0.92 + Math.random() * 0.16);
        spawnBullet({
          x: worldX, y: worldY,
          vx: Math.cos(shotAngle) * ballSpeed,
          vy: Math.sin(shotAngle) * ballSpeed,
          dmg: baseDmg,
          heavy: false,
          ownerId: ship.id,
          ownerIsNpc: ship.isNpc,
          travel: 0,
          maxRange: gunRange
        });
      }

      timerLane[i] = 0;
      firedAny = true;
    }
  }

  ship.gunTimer = getLegacyTimerFromMountLanes(ship, gunMountTimers, 'gun');
  if (firedAny) ship.gunTimer = 0;
}

// ─── Cannon auto-fire (server-side, all ships including player) ───

/**
 * Scan for the nearest enemy within cannon range on either broadside.
 * Fires automatically when reloaded. Returns { side, dx, dy, fired } or null.
 *
 * @param {object}   ship        - Firing ship
 * @param {Array}    targets     - Array of { ship, id }
 * @param {number}   dt          - Delta time
 * @param {function} spawnBullet - callback(bullet)
 */
export function tickCannonAutoFire(ship, targets, dt, spawnBullet) {
  if (!ship.alive) return null;

  ensureMountTimers(ship);

  const layout = ship.weaponLayout || { port: [], starboard: [] };
  const hasCannons = (layout.port || []).some(s => s === 'cannon') ||
                     (layout.starboard || []).some(s => s === 'cannon');
  if (!hasCannons) return null;

  const cannonRange = getCannonRange(ship);
  const fwd = forwardVector(ship.heading);
  const right = { x: -fwd.y, y: fwd.x };

  let bestTarget = null, bestDist = Infinity, bestSide = null, bestAimAngle = 0;

  for (const sideKey of ['starboard', 'port']) {
    const sideSign = sideKey === 'starboard' ? 1 : -1;
    const broadX = right.x * sideSign;
    const broadY = right.y * sideSign;
    const broadsideAngle = Math.atan2(broadY, broadX);
    const pivotRad = (ship.cannonPivot || 0) * (Math.PI / 180) + GUN_PIVOT_RAD + 0.15;

    for (const t of targets) {
      if (!t.ship.alive) continue;
      const dx = t.ship.x - ship.x;
      const dy = t.ship.y - ship.y;
      const d = Math.hypot(dx, dy);
      if (d > cannonRange || d >= bestDist) continue;
      const toAngle = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(toAngle, broadsideAngle)) > pivotRad) continue;
      bestDist = d;
      bestTarget = t;
      bestSide = sideKey;
      bestAimAngle = toAngle;
    }
  }

  if (!bestTarget) return null;

  const fired = fireCannonBroadside(ship, bestSide, bestAimAngle, spawnBullet);
  if (!fired) return null;

  const sideSign = bestSide === 'starboard' ? 1 : -1;
  return {
    side: bestSide,
    dx: -Math.sin(ship.heading) * sideSign,
    dy:  Math.cos(ship.heading) * sideSign,
    fired
  };
}

// ─── Cannon fire (manual for players, auto for NPCs) ───

/**
 * Fire cannons on a specific side toward a given aim angle.
 * Called when player clicks (server receives aim), or when NPC AI decides to fire.
 *
 * @param {object} ship      - Firing ship
 * @param {'port'|'starboard'} side - Which side to fire
 * @param {number} aimAngle  - World-space angle to fire toward
 * @param {function} spawnBullet - callback(bullet)
 * @returns {boolean} - true if any cannons fired
 */
export function fireCannonBroadside(ship, side, aimAngle, spawnBullet) {
  if (!ship.alive) return false;

  const layout = ship.weaponLayout || { port: [], starboard: [] };
  const lane = layout[side] || [];
  const { cannonMountTimers } = ensureMountTimers(ship);
  const timerLane = cannonMountTimers[side] || [];
  const shape = getHullShape(ship);
  const sideSign = side === 'starboard' ? 1 : -1;
  const efficiency = getCrewEfficiency(ship);
  const effectiveReload = (ship.cannonReload || 3.4) * (efficiency * 1.04);
  const pivotRad = (ship.cannonPivot || 0) * (Math.PI / 180) + GUN_PIVOT_RAD;
  if (!Number.isFinite(aimAngle)) return false;

  const cannonRange = getCannonRange(ship);
  const totalSlots = lane.length;
  let firedAny = false;

  for (let i = 0; i < totalSlots; i++) {
    if (lane[i] !== 'cannon') continue;
    if ((timerLane[i] || 0) < effectiveReload) continue;

    const mount = getHullSideMount(shape, i, totalSlots, sideSign);
    const mountAimAngle = getMountAimAngle(getMountFacingAngle(ship, mount), aimAngle, pivotRad + 0.12);
    if (mountAimAngle === null) continue;
    const cos = Math.cos(ship.heading);
    const sin = Math.sin(ship.heading);
    const CANNON_BARREL_LEN = 11.0;
    const tipX = mount.x + mount.nx * CANNON_BARREL_LEN;
    const tipY = mount.y + mount.ny * CANNON_BARREL_LEN;
    const worldX = ship.x + tipX * cos - tipY * sin;
    const worldY = ship.y + tipX * sin + tipY * cos;

    const spread = (Math.random() - 0.5) * CANNON_SPREAD * (1 - Math.min(0.8, ship.cannonAccuracyBonus || 0));
    const finalAngle = mountAimAngle + spread;
    const speed = (ship.bulletSpeed || 6) + BULLET_SPEED_CANNON_BONUS;

    spawnBullet({
      x: worldX,
      y: worldY,
      vx: Math.cos(finalAngle) * speed,
      vy: Math.sin(finalAngle) * speed,
      dmg: (ship.bulletDamage || 9) + CANNON_DMG_BONUS,
      heavy: true,
      ownerId: ship.id,
      ownerIsNpc: ship.isNpc,
      travel: 0,
      maxRange: cannonRange
    });
    timerLane[i] = 0;
    firedAny = true;
  }

  ship.cannonTimer = getLegacyTimerFromMountLanes(ship, cannonMountTimers, 'cannon');
  if (firedAny) ship.cannonTimer = 0;

  return firedAny;
}

// ─── Bullet update ───

/**
 * Step all bullets forward. Returns arrays of removed bullets (for events).
 *
 * @param {Array} bullets     - Mutable bullet array
 * @param {Array} ships       - Array of { ship, id } (hit targets)
 * @param {object} world      - { width, height }
 * @param {number} dt
 * @param {function} onHit    - callback(bullet, victimShip, damage) when bullet hits
 */
export function tickBullets(bullets, ships, world, dt, onHit) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // ── Pre-move hit check (catches bullets spawned inside enemy hull at close range) ──
    let hit = false;
    for (const t of ships) {
      const s = t.ship;
      if (s.id === b.ownerId || !s.alive) continue;
      if ((s.invulnTimer || 0) > 0) continue;
      const d = Math.hypot(s.x - b.x, s.y - b.y);
      const hitRadius = (s.size || 16) * 0.78 + 4;
      if (d < hitRadius) {
        const scale = b.heavy ? INCOMING_DMG_SCALE_CANNON : INCOMING_DMG_SCALE_GUN;
        onHit(b, s, b.dmg * scale);
        hit = true;
        break;
      }
    }
    if (hit) { bullets.splice(i, 1); continue; }

    // Move — keep previous position for swept building collision in simulation
    b.prevX = b.x;
    b.prevY = b.y;
    const stepX = b.vx * dt * 60;
    const stepY = b.vy * dt * 60;
    b.x += stepX;
    b.y += stepY;
    b.travel += Math.hypot(stepX, stepY);

    // Range / boundary check
    if (b.travel >= b.maxRange || b.x < -30 || b.x > world.width + 30 || b.y < -30 || b.y > world.height + 30) {
      bullets.splice(i, 1);
      continue;
    }

    // Post-move hit detection vs ships
    hit = false;
    for (const t of ships) {
      const s = t.ship;
      if (s.id === b.ownerId || !s.alive) continue;
      if ((s.invulnTimer || 0) > 0) continue;
      const d = Math.hypot(s.x - b.x, s.y - b.y);
      const hitRadius = (s.size || 16) * 0.78 + 4;
      if (d < hitRadius) {
        const scale = b.heavy ? INCOMING_DMG_SCALE_CANNON : INCOMING_DMG_SCALE_GUN;
        const dmg = b.dmg * scale;
        onHit(b, s, dmg);
        hit = true;
        break;
      }
    }

    if (hit) {
      bullets.splice(i, 1);
    }
  }
}

// ─── Damage application ───

/**
 * Apply damage to a ship. Handles HP reduction, repair suppression,
 * and fire ignition chance (cannons only).
 *
 * @param {object} ship    - Target ship
 * @param {number} amount  - Raw damage after scaling
 * @param {boolean} isHeavy - Was it a cannon hit (fire chance)?
 * @returns {boolean} - true if ship died from this damage
 */
export function applyDamage(ship, amount, isHeavy = false) {
  if (amount <= 0 || !ship.alive) return false;

  ship.hp -= amount;
  ship.repairSuppressed = Math.max(ship.repairSuppressed || 0, REPAIR_SUPPRESS_TIME);

  // Fire ignition from cannon hits
  if (isHeavy && !ship.onFire) {
    const chance = FIRE_CHANCE_BASE + amount * FIRE_CHANCE_PER_DMG;
    if (Math.random() < chance) {
      ship.onFire = true;
      ship.fireTimer = 0;
      ship.fireTicks = Math.ceil(FIRE_DURATION_BASE / FIRE_TICK_INTERVAL);
    }
  }

  return ship.hp <= 0;
}

// ─── Fire tick ───

/**
 * Tick fire damage on a burning ship.
 * @param {object} ship
 * @param {number} dt
 * @returns {boolean} - true if ship died from fire
 */
export function tickFire(ship, dt) {
  if (!ship.onFire || !ship.alive) return false;

  ship.fireTimer = (ship.fireTimer || 0) + dt;
  if (ship.fireTimer >= FIRE_TICK_INTERVAL) {
    ship.fireTimer -= FIRE_TICK_INTERVAL;
    ship.fireTicks = Math.max(0, (ship.fireTicks || 0) - 1);

    const dmg = ship.isNpc ? FIRE_DMG_ENEMY : FIRE_DMG_PLAYER;
    ship.hp -= dmg;
    ship.repairSuppressed = Math.max(ship.repairSuppressed || 0, REPAIR_SUPPRESS_TIME);

    if (ship.fireTicks <= 0) {
      ship.onFire = false;
    }

    return ship.hp <= 0;
  }

  return false;
}

// ─── Passive repair ───

/**
 * Tick passive repair on a ship (crew-based, suppressed after damage).
 * @param {object} ship
 * @param {number} dt
 */
export function tickRepair(ship, dt) {
  if (!ship.alive) return;

  const { gunMountTimers, cannonMountTimers } = ensureMountTimers(ship);

  ship.repairSuppressed = Math.max(0, (ship.repairSuppressed || 0) - dt);
  ship.invulnTimer = Math.max(0, (ship.invulnTimer || 0) - dt);
  ship.impactTimer = Math.max(0, (ship.impactTimer || 0) - dt);
  ship.cannonVolleyTimer = Math.max(0, (ship.cannonVolleyTimer || 0) - dt);

  advanceTimerLanes(gunMountTimers, dt);
  advanceTimerLanes(cannonMountTimers, dt);
  ship.gunTimer = getLegacyTimerFromMountLanes(ship, gunMountTimers, 'gun');
  ship.cannonTimer = getLegacyTimerFromMountLanes(ship, cannonMountTimers, 'cannon');

  if (ship.repairSuppressed <= 0 && ship.hp < ship.maxHp) {
    const rate = REPAIR_RATE_BASE + (ship.repairCrew || 0) * REPAIR_RATE_PER_CREW;
    // Movement reduces repair slightly
    const moveFactor = clamp(1 - (ship.speed || 0) * 0.08, 0.4, 1);
    ship.hp = Math.min(ship.maxHp, ship.hp + rate * moveFactor * dt);
  }
}
