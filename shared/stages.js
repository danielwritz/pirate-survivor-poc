/**
 * Difficulty stages — pure logic, no side-effects.
 * Used by both server and (optionally) client.
 */

import {
  STAGE_CALM_WATERS,
  STAGE_CONTESTED_SEAS,
  STAGE_WAR_ZONE,
  STAGE_KRAKEN_FRONTIER,
  STAGE_BOUNDARIES,
  STAGE_ARCHETYPE_POOLS
} from './constants.js';

export {
  STAGE_CALM_WATERS,
  STAGE_CONTESTED_SEAS,
  STAGE_WAR_ZONE,
  STAGE_KRAKEN_FRONTIER,
  STAGE_BOUNDARIES,
  STAGE_ARCHETYPE_POOLS
};

/**
 * Return the stage name for a given round time (seconds elapsed since round start).
 * @param {number} roundTime - Seconds elapsed since round start
 * @returns {string} Stage name constant
 */
export function getCurrentStage(roundTime) {
  for (const boundary of STAGE_BOUNDARIES) {
    if (roundTime < boundary.end) return boundary.stage;
  }
  return STAGE_KRAKEN_FRONTIER;
}

/**
 * Return the allowed NPC archetype keys for a given round time.
 * @param {number} roundTime
 * @returns {string[]}
 */
export function getAllowedArchetypes(roundTime) {
  return STAGE_ARCHETYPE_POOLS[getCurrentStage(roundTime)];
}
