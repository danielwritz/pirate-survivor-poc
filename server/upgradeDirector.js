/**
 * Upgrade Director — manages XP/leveling, upgrade offers, and applying upgrades.
 * Server-side only. Works with the shared upgradeRegistry.
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildMpCatalog, applyUpgrade, rollUpgradeOffer, applyRandomUpgrades } from '../shared/upgradeRegistry.js';
import { normalizeWeaponLayout, syncArmamentDerivedStats } from '../src/core/armament.js';
import { XP_START, XP_SCALE, XP_ADD } from '../shared/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let catalog = null;

/**
 * Load the upgrade catalog from data/upgrades.json.
 * Must be called once at server start.
 */
export async function loadCatalog() {
  const raw = JSON.parse(await readFile(join(__dirname, '..', 'data', 'upgrades.json'), 'utf-8'));
  catalog = buildMpCatalog(raw);
  console.log(`Upgrade catalog loaded: ${catalog.standard.length} standard, ${catalog.major.length} major`);
  return catalog;
}

export function getCatalog() {
  return catalog;
}

/**
 * Initialize a ship with the starter weapon layout (matches SP starter preset: balanced brig).
 * 2 guns per side, 1 cannon per side, basic crew.
 */
export function initStarterLoadout(ship) {
  // Ensure weapon layout is normalized for hull size
  normalizeWeaponLayout(ship);

  // Place starter weapons: 2 guns + 1 cannon per side (balanced brig)
  const slots = ship.weaponLayout.port.length;
  for (const side of ['port', 'starboard']) {
    const lane = ship.weaponLayout[side];
    // First 2 slots = gun, next 1 = cannon, rest empty
    for (let i = 0; i < lane.length; i++) {
      if (i < 2) lane[i] = 'gun';
      else if (i === 2) lane[i] = 'cannon';
      else lane[i] = 'empty';
    }
  }

  // Sync derived counts
  syncArmamentDerivedStats(ship);

  // Starter crew: 1 rower, 4 gunners, 1 repair
  ship.crew = 6;
  ship.rowers = 1;
  ship.gunners = 4;
  ship.repairCrew = 1;
}

/**
 * Award XP to a ship (from gold pickup, kills, etc).
 * Returns upgrade offer if a level-up occurred, null otherwise.
 */
export function awardXp(ship, amount) {
  if (!catalog) return null;

  ship.xp += amount;

  // Check for level up
  if (ship.xp >= ship.xpToNext) {
    ship.xp -= ship.xpToNext;
    ship.level += 1;
    ship.xpToNext = Math.floor(ship.xpToNext * XP_SCALE + XP_ADD);

    // Level growth: +0.6 size, +2 maxHp, +4 heal
    ship.size += 0.6;
    ship.maxHp += 2;
    ship.hp = Math.min(ship.maxHp, ship.hp + 4);

    // Roll standard upgrade offer
    const offer = rollUpgradeOffer('standard', 3, catalog);
    ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));

    return ship.upgradeOffer;
  }

  // Check for major upgrade milestone (every 5 levels)
  // (This is checked separately so standard and major can stack)
  if (ship.level > 1 && ship.level % 5 === 0 && !ship._lastMajorLevel) {
    ship._lastMajorLevel = ship.level;
    const offer = rollUpgradeOffer('major', 3, catalog);
    ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
    return ship.upgradeOffer;
  }

  return null;
}

/**
 * Initialize the starting upgrade offer sequence for a newly joined ship.
 * Sets ship.startingPicksRemaining = 3 and populates the first offer.
 * @returns {Array} the first offer array
 */
export function initStartingUpgradeOffer(ship) {
  if (!catalog) return null;
  ship.startingPicksRemaining = 3;
  const offer = rollUpgradeOffer('standard', 3, catalog);
  ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
  return ship.upgradeOffer;
}

/**
 * Player selected an upgrade from the offer.
 * @param {object} ship
 * @param {number} choiceIndex - 0, 1, or 2
 * @returns {{ applied: boolean, upgradeId: string|null, nextOffer: Array|null, startingPicksRemaining: number }}
 */
export function selectUpgrade(ship, choiceIndex) {
  if (!ship.upgradeOffer || !catalog) return { applied: false, upgradeId: null, nextOffer: null, startingPicksRemaining: 0 };
  if (choiceIndex < 0 || choiceIndex >= ship.upgradeOffer.length) return { applied: false, upgradeId: null, nextOffer: null, startingPicksRemaining: 0 };

  const choice = ship.upgradeOffer[choiceIndex];
  const result = applyUpgrade(ship, choice.id, catalog);

  // Clear offer
  ship.upgradeOffer = null;

  // Handle starting picks sequence
  let nextOffer = null;
  let startingPicksRemaining = 0;
  if (typeof ship.startingPicksRemaining === 'number' && ship.startingPicksRemaining > 0) {
    ship.startingPicksRemaining -= 1;
    startingPicksRemaining = ship.startingPicksRemaining;
    if (ship.startingPicksRemaining > 0) {
      const offer = rollUpgradeOffer('standard', 3, catalog);
      ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
      nextOffer = ship.upgradeOffer;
    }
  }

  return { applied: result.success, upgradeId: choice.id, nextOffer, startingPicksRemaining };
}

/**
 * Apply random upgrades to an NPC ship for difficulty scaling.
 */
export function scaleNpcWithUpgrades(ship, upgradeCount) {
  if (!catalog) return;
  applyRandomUpgrades(ship, upgradeCount, catalog);
}
