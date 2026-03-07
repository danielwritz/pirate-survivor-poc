/**
 * Boss Director — Kraken archetype.
 * Server-side only.
 *
 * Kraken: stationary area-denial boss that spawns at a random deep-water location.
 * Creates tentacle hazard zones in a radius around itself.
 * Ships within the hazard zone take periodic damage.
 * Requires sustained DPS to defeat.
 */

import {
  KRAKEN_AREA_RADIUS,
  KRAKEN_DMG_PER_TICK,
  KRAKEN_PULSE_INTERVAL,
  KRAKEN_HP_BASE,
  KRAKEN_HP_PER_TIER
} from '../shared/constants.js';

let _nextBossId = 90000;

// ─── Kraken factory ───

/**
 * Create a new Kraken boss entity.
 * @param {number} x - World X position
 * @param {number} y - World Y position
 * @param {number} [tier=0] - Difficulty tier (scales HP)
 * @returns {object} Boss entity
 */
export function createKrakenBoss(x = 0, y = 0, tier = 0) {
  const maxHp = KRAKEN_HP_BASE + tier * KRAKEN_HP_PER_TIER;
  return {
    id: _nextBossId++,
    archetype: 'kraken',
    x,
    y,
    tier,
    hp: maxHp,
    maxHp,
    alive: true,
    areaEffect: {
      active: true,
      radius: KRAKEN_AREA_RADIUS
    },
    _pulseTimer: KRAKEN_PULSE_INTERVAL
  };
}

// ─── Kraken AI tick ───

/**
 * Tick the Kraken boss AI.
 * The Kraken is stationary — it does not move.
 * Every KRAKEN_PULSE_INTERVAL seconds it deals KRAKEN_DMG_PER_TICK damage to all
 * ships within its hazard radius and broadcasts an `areaDenial` event.
 *
 * @param {object} boss - Kraken entity created by createKrakenBoss
 * @param {object[]} ships - Array of ship objects (players or NPCs)
 * @param {number} dt - Delta time in seconds
 * @param {object[]} events - Mutable event array to push broadcast events into
 */
export function tickKrakenBoss(boss, ships, dt, events) {
  if (!boss.alive) return;

  boss._pulseTimer -= dt;
  if (boss._pulseTimer > 0) return;

  // Reset pulse timer
  boss._pulseTimer = KRAKEN_PULSE_INTERVAL;

  // Apply area damage to all ships within the hazard radius
  const radiusSq = boss.areaEffect.radius * boss.areaEffect.radius;
  for (const ship of ships) {
    if (!ship || !ship.alive) continue;
    const dx = ship.x - boss.x;
    const dy = ship.y - boss.y;
    if (dx * dx + dy * dy <= radiusSq) {
      ship.hp -= KRAKEN_DMG_PER_TICK;
    }
  }

  // Broadcast area denial event
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
