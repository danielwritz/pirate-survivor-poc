/**
 * Boss Director — spawns and manages the single active boss NPC.
 * Server-side only.
 *
 * Archetype interface: tickBossAi(boss, state) is called each tick per active boss.
 * Concrete archetypes (War Galleon, Fire Ship, Kraken) are implemented in Stories 2-4.
 * Story 1 spawns a generic war_galleon placeholder.
 *
 * Scheduling: first boss at BOSS_FIRST_SPAWN_TIME, then BOSS_SPAWN_INTERVAL after each death.
 * Single-instance limit: only one boss alive at a time; attempts are deferred if one exists.
 */

import { createShip, getCannonRange } from '../shared/shipState.js';
import { initStarterLoadout, triggerMajorOffer } from './upgradeDirector.js';
import { syncArmamentDerivedStats } from '../src/core/armament.js';
import { forwardVector } from '../shared/physics.js';
import { fireCannonBroadside } from '../shared/combat.js';
import {
  BASE_SIZE, BASE_BULLET_SPEED,
  BOSS_FIRST_SPAWN_TIME, BOSS_SPAWN_INTERVAL,
  BOSS_TIER_DURATION, BOSS_MAX_TIER,
  BOSS_HP_BASE, BOSS_HP_PER_TIER, BOSS_HP_PER_PLAYER,
  WORLD_EDGE_PAD,
  WAR_GALLEON_SIZE_MUL, WAR_GALLEON_CANNON_COUNT,
  WAR_GALLEON_BROADSIDE_INTERVAL, WAR_GALLEON_CANNON_DAMAGE,
  WAR_GALLEON_HP_PER_TIER, WAR_GALLEON_HP_PER_PLAYER,
  KRAKEN_AREA_RADIUS, KRAKEN_DMG_PER_TICK,
  KRAKEN_PULSE_INTERVAL, KRAKEN_HP_BASE, KRAKEN_HP_PER_TIER,
  BOSS_KILL_BASE_DOUBLOONS, BOSS_KILL_DOUBLOONS_PER_TIER,
  BOSS_SPLASH_RADIUS, BOSS_SPLASH_PERCENT
} from '../shared/constants.js';

// ─── Boss archetypes (Story 7) ───

export const BOSS_ARCHETYPES = {
  war_galleon: { displayName: 'War Galleon' },
  fire_ship:   { displayName: 'Fire Ship'   },
  kraken:      { displayName: 'Kraken'      }
};

export function getBossDisplayName(bossType) {
  return BOSS_ARCHETYPES[bossType]?.displayName ?? String(bossType);
}

export const BOSS_SCHEDULE = [
  { time: 150, bossType: 'war_galleon' },
  { time: 270, bossType: 'fire_ship'   },
  { time: 420, bossType: 'war_galleon' },
  { time: 540, bossType: 'kraken'      }
];

let nextBossId = 90000;

// ─── HP formula ───

/**
 * Compute boss max HP based on difficulty tier and current player count.
 * tier is clamped to BOSS_MAX_TIER.
 */
export function computeBossHp(tier, playerCount) {
  const clampedTier = Math.min(Math.max(1, tier), BOSS_MAX_TIER);
  return BOSS_HP_BASE + clampedTier * BOSS_HP_PER_TIER + playerCount * BOSS_HP_PER_PLAYER;
}

// ─── War Galleon Archetype (Story 2) ───

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI)  d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Configure a ship as a War Galleon boss.
 */
export function applyWarGalleonArchetype(ship, tier = 1, playerCount = 1) {
  ship.name         = 'War Galleon';
  ship.isBoss       = true;
  ship.bossArchetype = 'war_galleon';
  ship.size = BASE_SIZE * WAR_GALLEON_SIZE_MUL;
  ship.mass = ship.size * 4;
  const hp = WAR_GALLEON_HP_PER_TIER * tier + WAR_GALLEON_HP_PER_PLAYER * playerCount;
  ship.maxHp = hp;
  ship.hp    = hp;
  ship.bulletDamage = WAR_GALLEON_CANNON_DAMAGE;
  ship.bulletSpeed  = BASE_BULLET_SPEED;
  const cannonsPerSide = WAR_GALLEON_CANNON_COUNT / 2;
  ship.weaponLayout = {
    port:      Array(cannonsPerSide).fill('cannon'),
    starboard: Array(cannonsPerSide).fill('cannon')
  };
  ship.cannonPivot  = 180;
  ship.cannonReload = 1.0;
  ship.gunners      = 12;
  ship.cannonMountTimers = {
    port:      Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL),
    starboard: Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL)
  };
  ship.hullColor = '#2a1f15';
  ship.trimColor = '#c8a050';
  ship.sailColor = '#8a0000';
  syncArmamentDerivedStats(ship);
  return ship;
}

function fireMassiveBroadside(ship, aimAngle, spawnBullet) {
  const cannonsPerSide = WAR_GALLEON_CANNON_COUNT / 2;
  ship.cannonMountTimers.port      = Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL);
  ship.cannonMountTimers.starboard = Array(cannonsPerSide).fill(WAR_GALLEON_BROADSIDE_INTERVAL);
  const firedPort      = fireCannonBroadside(ship, 'port',      aimAngle, spawnBullet);
  const firedStarboard = fireCannonBroadside(ship, 'starboard', aimAngle, spawnBullet);
  return firedPort || firedStarboard;
}

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
        const cross        = fwd.x * dy - fwd.y * dx;
        const perpHeading  = angleToTarget + (cross >= 0 ? -Math.PI / 2 : Math.PI / 2);
        const hdiff        = angleDiff(perpHeading, ship.heading);
        if (hdiff > 0.08)       input.turnRight = true;
        else if (hdiff < -0.08) input.turnLeft  = true;
        if (dist < cannonRange * 0.5)      input.brake   = true;
        else if (dist > cannonRange * 1.1) input.forward = true;
        else                               input.forward  = false;
        if (ai.broadsideTimer >= WAR_GALLEON_BROADSIDE_INTERVAL && dist < cannonRange) {
          const firedAny = fireMassiveBroadside(ship, angleToTarget, spawnBullet);
          if (firedAny) {
            ai.broadsideTimer = 0;
            if (events) {
              events.push({ type: 'bossBroadside', bossId: ship.id, bossType: 'war_galleon', x: ship.x, y: ship.y });
            }
          }
        }
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

// ─── Archetype dispatch interface ───

/**
 * Tick AI for the active boss.
 * @param {object} boss - { ship, aiState, archetype }
 * @param {object} state - { playerShips, world, dt, spawnBullet, events }
 */
export function tickBossAi(boss, state) {
  switch (boss.ship.bossArchetype) {
    case 'war_galleon':
      tickWarGalleonAi(boss, state.playerShips, state.dt || 0.05, state.spawnBullet || (() => {}), state.events);
      break;
    default:
      boss.ship._input = { forward: true, brake: false, turnLeft: false, turnRight: false, sailOpen: true, anchored: false };
  }
}

// ─── Director lifecycle ───

export function createBossDirector() {
  return {
    boss: null,                         // active boss: { ship, aiState, archetype, tier }
    nextBossTime: BOSS_FIRST_SPAWN_TIME // round-time (seconds) when next boss spawn is attempted
  };
}

/**
 * Spawn a boss at a world edge, preferring positions far from players.
 * Returns the new boss ship id.
 */
export function spawnBoss(director, playerPositions, roundTime, world) {
  const id = nextBossId++;
  const worldWidth  = Number.isFinite(world?.width)  ? world.width  : 3000;
  const worldHeight = Number.isFinite(world?.height) ? world.height : 2100;

  const pickEdgePos = () => {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: return { x: WORLD_EDGE_PAD + 30, y: WORLD_EDGE_PAD + Math.random() * (worldHeight - WORLD_EDGE_PAD * 2) };
      case 1: return { x: worldWidth - WORLD_EDGE_PAD - 30, y: WORLD_EDGE_PAD + Math.random() * (worldHeight - WORLD_EDGE_PAD * 2) };
      case 2: return { x: WORLD_EDGE_PAD + Math.random() * (worldWidth - WORLD_EDGE_PAD * 2), y: WORLD_EDGE_PAD + 30 };
      default: return { x: WORLD_EDGE_PAD + Math.random() * (worldWidth - WORLD_EDGE_PAD * 2), y: worldHeight - WORLD_EDGE_PAD - 30 };
    }
  };

  let { x, y } = pickEdgePos();
  if (playerPositions.length > 0) {
    let bestX = x, bestY = y, bestMinDist = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { x: cx, y: cy } = pickEdgePos();
      let minDist = Infinity;
      for (const p of playerPositions) {
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) { bestMinDist = minDist; bestX = cx; bestY = cy; }
    }
    x = bestX; y = bestY;
  }

  const tier = Math.min(BOSS_MAX_TIER, Math.floor(roundTime / BOSS_TIER_DURATION) + 1);

  const ship = createShip(x, y, { id, name: 'War Galleon', isNpc: true });
  initStarterLoadout(ship);

  // Apply the War Galleon archetype (Story 2)
  applyWarGalleonArchetype(ship, tier, playerPositions.length);

  const aiState = {
    mode:      'approach',
    modeTimer: 0,
    stuckTimer: 0,
    lastX:     x,
    lastY:     y,
    avoidTimer: 0,
    avoidDir:  1
  };

  director.boss = { ship, aiState, archetype: 'war_galleon', tier };
  return id;
}

/**
 * Remove the active boss (called after death is fully processed).
 */
export function removeBoss(director) {
  director.boss = null;
}

/**
 * True if a boss exists and is alive.
 */
export function isBossAlive(director) {
  return director.boss !== null && director.boss.ship.alive;
}

/**
 * Return the active boss object if alive, otherwise null.
 */
export function getActiveBoss(director) {
  return isBossAlive(director) ? director.boss : null;
}

/**
 * Convenience accessor: return the boss ship or null.
 */
export function getBossShip(director) {
  return director.boss?.ship || null;
}

/**
 * Main director tick.
 * - Detects boss death and schedules the next spawn window.
 * - Spawns a new boss when the round-time reaches nextBossTime (and no boss is alive).
 * - Dispatches tickBossAi for the active boss.
 *
 * @param {object} director
 * @param {Array}  playerShips   - live player ship objects (for spawn positioning + HP scaling)
 * @param {object} world         - { width, height }
 * @param {number} roundTime     - seconds elapsed in the current round
 * @param {Array}  events        - per-tick event queue (may be null in tests)
 */
export function tickBossDirector(director, playerShips, world, roundTime, dt, spawnBullet, events) {
  // Detect boss death and schedule next spawn
  if (director.boss && !director.boss.ship.alive) {
    director.nextBossTime = roundTime + BOSS_SPAWN_INTERVAL;
    director.boss = null;
  }

  // Try to spawn when timer fires and no boss is active
  if (!isBossAlive(director) && roundTime >= director.nextBossTime && playerShips.length > 0) {
    const positions = playerShips.map(s => ({ x: s.x, y: s.y }));
    spawnBoss(director, positions, roundTime, world);
    if (events) {
      events.push({
        type: 'bossSpawn',
        bossType: director.boss.archetype,
        x: director.boss.ship.x,
        y: director.boss.ship.y
      });
    }
    director.nextBossTime = roundTime + BOSS_SPAWN_INTERVAL;
    return;
  }

  // Tick active boss AI
  if (isBossAlive(director)) {
    tickBossAi(director.boss, { playerShips, world, dt, spawnBullet, events });
  }
}

// ─── Kraken archetype ───

export function createKrakenBoss(x = 0, y = 0, tier = 0) {
  const maxHp = KRAKEN_HP_BASE + tier * KRAKEN_HP_PER_TIER;
  return {
    id: nextBossId++,
    archetype: 'kraken',
    x, y, tier,
    hp: maxHp,
    maxHp,
    alive: true,
    areaEffect: { active: true, radius: KRAKEN_AREA_RADIUS },
    _pulseTimer: KRAKEN_PULSE_INTERVAL
  };
}

export function tickKrakenBoss(boss, ships, dt, events) {
  if (!boss.alive) return;
  boss._pulseTimer -= dt;
  if (boss._pulseTimer > 0) return;
  boss._pulseTimer = KRAKEN_PULSE_INTERVAL;

  const radiusSq = boss.areaEffect.radius * boss.areaEffect.radius;
  for (const ship of ships) {
    if (!ship || !ship.alive) continue;
    const dx = ship.x - boss.x;
    const dy = ship.y - boss.y;
    if (dx * dx + dy * dy <= radiusSq) {
      ship.hp -= KRAKEN_DMG_PER_TICK;
    }
  }

  if (events) {
    events.push({
      type: 'areaDenial',
      id: boss.id,
      x: boss.x,
      y: boss.y,
      radius: boss.areaEffect.radius
    });
  }
}

// ─── Boss kill rewards ───

export function distributeBossKillRewards(boss, killerShip, allPlayerShips, tier) {
  const baseDoubloons = BOSS_KILL_BASE_DOUBLOONS + BOSS_KILL_DOUBLOONS_PER_TIER * tier;

  killerShip.doubloons = (killerShip.doubloons || 0) + baseDoubloons;
  triggerMajorOffer(killerShip);

  const splashDoubloons = Math.floor(baseDoubloons * BOSS_SPLASH_PERCENT);
  for (const ship of allPlayerShips) {
    if (ship.id === killerShip.id) continue;
    const dx = ship.x - boss.x;
    const dy = ship.y - boss.y;
    if (Math.sqrt(dx * dx + dy * dy) <= BOSS_SPLASH_RADIUS) {
      ship.doubloons = (ship.doubloons || 0) + splashDoubloons;
    }
  }

  return { killerDoubloons: baseDoubloons, splashDoubloons };
}

// ─── Boss defeated callback (Story 7) ───

export function onBossDefeated(director) {
  director.boss = null;
  director.nextBossTime = Infinity;  // reset until scheduled
}
