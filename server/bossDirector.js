/**
 * Boss Director — reward distribution for boss kills.
 * Handles doubloon payouts and major upgrade offer triggers when a boss dies.
 */

import {
  BOSS_KILL_BASE_DOUBLOONS,
  BOSS_KILL_DOUBLOONS_PER_TIER,
  BOSS_SPLASH_RADIUS,
  BOSS_SPLASH_PERCENT,
} from '../shared/constants.js';
import { triggerMajorOffer } from './upgradeDirector.js';

/**
 * Distribute rewards when a boss is killed.
 *
 * - Killing player receives `BOSS_KILL_BASE_DOUBLOONS + BOSS_KILL_DOUBLOONS_PER_TIER * tier`
 *   doubloons and an immediate major upgrade offer.
 * - All other players within BOSS_SPLASH_RADIUS units of the boss death location
 *   receive `floor(baseDoubloons * BOSS_SPLASH_PERCENT)` doubloons.
 * - Players outside BOSS_SPLASH_RADIUS receive nothing.
 *
 * @param {{ x: number, y: number, isBoss: boolean }} boss  - The defeated boss entity.
 * @param {{ id: *, doubloons?: number }} killerShip        - Ship that landed the killing blow.
 * @param {Array<{ id: *, x: number, y: number, doubloons?: number }>} allPlayerShips - All player ships.
 * @param {number} tier  - Current difficulty tier (e.g. Math.floor(roundTime / 60)).
 * @returns {{ killerDoubloons: number, splashDoubloons: number }}
 */
export function distributeBossKillRewards(boss, killerShip, allPlayerShips, tier) {
  const baseDoubloons = BOSS_KILL_BASE_DOUBLOONS + BOSS_KILL_DOUBLOONS_PER_TIER * tier;

  // Full reward for the killing player
  killerShip.doubloons = (killerShip.doubloons || 0) + baseDoubloons;
  triggerMajorOffer(killerShip);

  // Splash reward for nearby players (excluding the killer)
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
