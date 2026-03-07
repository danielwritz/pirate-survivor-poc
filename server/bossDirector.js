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

import { createShip } from '../shared/shipState.js';
import { initStarterLoadout, triggerMajorOffer } from './upgradeDirector.js';
import {
  BOSS_FIRST_SPAWN_TIME, BOSS_SPAWN_INTERVAL,
  BOSS_TIER_DURATION, BOSS_MAX_TIER,
  BOSS_HP_BASE, BOSS_HP_PER_TIER, BOSS_HP_PER_PLAYER,
  WORLD_EDGE_PAD,
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

// ─── Archetype dispatch interface ───

/**
 * Tick AI for the active boss.
 * Concrete behavior is provided by Stories 2-4; this stub keeps the boss moving forward
 * as a war_galleon placeholder.
 * @param {object} boss - { ship, aiState, archetype }
 * @param {object} state - { playerShips, world }
 */
export function tickBossAi(boss, state) {
  // Placeholder: move forward until the real war_galleon archetype is implemented (Story 2)
  boss.ship._input = {
    forward: true,
    brake: false,
    turnLeft: false,
    turnRight: false,
    sailOpen: true,
    anchored: false
  };
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
  const hp   = computeBossHp(tier, playerPositions.length);

  const ship = createShip(x, y, { id, name: 'War Galleon', isNpc: true });
  initStarterLoadout(ship);

  // Boss-scale modifiers (large, slow, high HP)
  ship.isBoss        = true;
  ship.bossArchetype = 'war_galleon';
  ship.size         *= 1.8;
  ship.mass         *= 2.2;
  ship.maxHp         = hp;
  ship.hp            = hp;
  ship.baseSpeed    *= 0.75;
  ship.hullColor     = '#2a1a0e';
  ship.sailColor     = '#1a1a2a';
  ship.trimColor     = '#8b6a3a';

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
export function tickBossDirector(director, playerShips, world, roundTime, events) {
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
        archetype: director.boss.archetype,
        x: director.boss.ship.x,
        y: director.boss.ship.y
      });
    }
    // Next attempt is scheduled only after this boss dies (handled above)
    // Set a far-future guard so a crash-loop doesn't double-spawn this tick
    director.nextBossTime = roundTime + BOSS_SPAWN_INTERVAL;
    return;
  }

  // Tick active boss AI
  if (isBossAlive(director)) {
    tickBossAi(director.boss, { playerShips, world });
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
