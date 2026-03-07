/**
 * Boss Director — spawns boss NPCs on a schedule and emits bossSpawn events.
 * Server-side only. Depends on Story 1 boss archetypes for full behaviour;
 * this module handles scheduling and event emission (Story 7).
 */

import { WORLD_EDGE_PAD } from '../shared/constants.js';

// ─── Boss archetypes ───

export const BOSS_ARCHETYPES = {
  war_galleon: { displayName: 'War Galleon' },
  fire_ship:   { displayName: 'Fire Ship'   },
  kraken:      { displayName: 'Kraken'      }
};

/**
 * Returns the human-readable name for a boss archetype key.
 * @param {string} bossType
 * @returns {string}
 */
export function getBossDisplayName(bossType) {
  return BOSS_ARCHETYPES[bossType]?.displayName ?? String(bossType);
}

// ─── Spawn schedule ───
// Each entry fires once when roundTime (elapsed seconds) crosses `time`.
// Boss 4 spawns slightly before the final minute to give players a clear target.
const BOSS_SCHEDULE = [
  { time: 150, bossType: 'war_galleon' }, // ~2:30 — first real threat
  { time: 270, bossType: 'fire_ship'   }, // ~4:30 — mid-game escalation
  { time: 420, bossType: 'war_galleon' }, // ~7:00 — war zone climax
  { time: 540, bossType: 'kraken'      }  // ~9:00 — Kraken Frontier
];

// ─── Factory ───

export function createBossDirector() {
  return {
    activeBossId: null,   // id of the currently live boss NPC, or null
    scheduleIndex: 0,     // next entry to evaluate in BOSS_SCHEDULE
    spawnCooldown: 0      // seconds to wait after a boss dies before next spawn
  };
}

// ─── Helpers ───

function computeSpawnPosition(scheduleIndex, world) {
  const pad = Math.max(100, WORLD_EDGE_PAD * 4);
  // Distribute bosses around the map so each feels like it arrives from a
  // different direction.
  const positions = [
    { x: world.width * 0.75, y: world.height * 0.25 },
    { x: world.width * 0.25, y: world.height * 0.75 },
    { x: world.width * 0.5,  y: world.height * 0.25 },
    { x: world.width * 0.5,  y: world.height * 0.5  }
  ];
  const p = positions[scheduleIndex % positions.length];
  return {
    x: Math.round(Math.min(Math.max(p.x, pad), world.width  - pad)),
    y: Math.round(Math.min(Math.max(p.y, pad), world.height - pad))
  };
}

// ─── Tick ───

/**
 * Advance the boss director by one simulation tick.
 *
 * When the next scheduled boss is due and no boss is currently active, pushes
 * a `{ type: 'bossSpawn', bossType, x, y }` event to the events array.
 *
 * @param {object} bd         - boss director state (from createBossDirector)
 * @param {number} roundTime  - elapsed round time in seconds
 * @param {number} dt         - tick delta-time in seconds
 * @param {object} world      - { width, height }
 * @param {Array}  events     - sim.events array to push into
 */
export function tickBossDirector(bd, roundTime, dt, world, events) {
  if (bd.scheduleIndex >= BOSS_SCHEDULE.length) return; // all bosses spawned

  // Wait out any post-death cooldown
  if (bd.spawnCooldown > 0) {
    bd.spawnCooldown = Math.max(0, bd.spawnCooldown - dt);
    return;
  }

  // Only one boss at a time
  if (bd.activeBossId !== null) return;

  const next = BOSS_SCHEDULE[bd.scheduleIndex];
  if (roundTime < next.time) return;

  const pos = computeSpawnPosition(bd.scheduleIndex, world);
  bd.scheduleIndex++;

  // Mark a synthetic active id so we don't double-spawn before NPC creation
  bd.activeBossId = `boss_${bd.scheduleIndex}`;

  events.push({
    type: 'bossSpawn',
    bossType: next.bossType,
    x: pos.x,
    y: pos.y
  });
}

/**
 * Notify the boss director that the active boss has been defeated.
 * Starts the cooldown before the next boss is allowed to spawn.
 *
 * @param {object} bd
 */
export function onBossDefeated(bd) {
  bd.activeBossId = null;
  bd.spawnCooldown = 30; // 30 s grace period
}
