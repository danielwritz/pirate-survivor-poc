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
  ship.pendingLevelUpOffers = Math.max(0, ship.pendingLevelUpOffers || 0);
  ship.pendingMajorOffers = Math.max(0, ship.pendingMajorOffers || 0);
  ship._lastMajorLevel = Math.max(0, ship._lastMajorLevel || 0);

  // Process all level-ups from this XP gain
  let leveled = 0;
  let gainedMajorOffers = 0;
  while (ship.xp >= ship.xpToNext) {
    ship.xp -= ship.xpToNext;
    ship.level += 1;
    ship.xpToNext = Math.floor(ship.xpToNext * XP_SCALE + XP_ADD);

    // Level growth: +0.6 size, +2 maxHp, +4 heal
    ship.size += 0.6;
    ship.maxHp += 2;
    ship.hp = Math.min(ship.maxHp, ship.hp + 4);

    leveled += 1;

    if (ship.level > 1 && ship.level % 5 === 0 && ship.level > ship._lastMajorLevel) {
      gainedMajorOffers += 1;
      ship._lastMajorLevel = ship.level;
    }
  }

  if (leveled > 0) {
    ship.pendingLevelUpOffers += leveled;
    ship.pendingMajorOffers += gainedMajorOffers;

    if (!ship.upgradeOffer) {
      if (ship.pendingMajorOffers > 0) {
        const offer = rollUpgradeOffer('major', 3, catalog);
        ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
        ship.pendingMajorOffers -= 1;
      } else if (ship.pendingLevelUpOffers > 0) {
        const offer = rollUpgradeOffer('standard', 3, catalog);
        ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
        ship.pendingLevelUpOffers -= 1;
      }
      return ship.upgradeOffer;
    }
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
  ship.pendingLevelUpOffers = Math.max(0, ship.pendingLevelUpOffers || 0);
  ship.pendingMajorOffers = Math.max(0, ship.pendingMajorOffers || 0);
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
  let consumedStartingPick = false;
  if (typeof ship.startingPicksRemaining === 'number' && ship.startingPicksRemaining > 0) {
    consumedStartingPick = true;
    ship.startingPicksRemaining -= 1;
    startingPicksRemaining = ship.startingPicksRemaining;
    if (ship.startingPicksRemaining > 0) {
      const offer = rollUpgradeOffer('standard', 3, catalog);
      ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
      nextOffer = ship.upgradeOffer;
    }
  }

  if (!nextOffer && (consumedStartingPick ? ship.startingPicksRemaining <= 0 : true)) {
    if ((ship.pendingMajorOffers || 0) > 0) {
      ship.pendingMajorOffers = Math.max(0, ship.pendingMajorOffers - 1);
      const offer = rollUpgradeOffer('major', 3, catalog);
      ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
      nextOffer = ship.upgradeOffer;
    } else if ((ship.pendingLevelUpOffers || 0) > 0) {
      ship.pendingLevelUpOffers = Math.max(0, ship.pendingLevelUpOffers - 1);
      const offer = rollUpgradeOffer('standard', 3, catalog);
      ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
      nextOffer = ship.upgradeOffer;
    }
  }

  return { applied: result.success, upgradeId: choice.id, nextOffer, startingPicksRemaining };
}

/**
 * Immediately trigger a major upgrade offer for a ship (e.g. after a boss kill).
 * Sets majorOfferTriggered = true and, if the catalog is loaded, populates
 * ship.upgradeOffer with a major-tier offer right away.
 */
export function triggerMajorOffer(ship) {
  ship.majorOfferTriggered = true;
  ship.pendingMajorOffers = (ship.pendingMajorOffers || 0) + 1;
  if (catalog && !ship.upgradeOffer) {
    const offer = rollUpgradeOffer('major', 3, catalog);
    ship.upgradeOffer = offer.map(u => ({ id: u.id, name: u.name, desc: u.desc }));
    ship.pendingMajorOffers = Math.max(0, ship.pendingMajorOffers - 1);
  }
}

/**
 * Apply random upgrades to an NPC ship for difficulty scaling.
 */
export function scaleNpcWithUpgrades(ship, upgradeCount) {
  if (!catalog) return;
  applyRandomUpgrades(ship, upgradeCount, catalog);
}
