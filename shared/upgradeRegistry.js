/**
 * Shared upgrade registry — loads upgrade catalog from data/upgrades.json
 * and provides MP-compatible application via the existing rule engine.
 *
 * Runs on server (primary) and can run on client for preview/display.
 * No DOM/canvas deps.
 */

import { applyUpgradeRuleSet, createUpgradeCatalog } from '../src/systems/upgradeRuleEngine.js';
import { normalizeWeaponLayout, clampArmamentToHull, autoInstallCannons, autoInstallGuns, syncArmamentDerivedStats } from '../src/core/armament.js';
import { clamp } from '../src/core/math.js';

// ─── Cut list: upgrades removed from MP pool ───
const MP_CUT_IDS = new Set([
  'salvage-skiffs'   // No auto-loot boats in MP
]);

// ─── Hull armor visual tiers ───
const ARMOR_COLORS = [
  { hull: '#5f4630', trim: '#d9b78d' },  // Tier 0: wood
  { hull: '#5a4a3a', trim: '#b8a282' },  // Tier 1: reinforced
  { hull: '#4e4238', trim: '#9a8a72' },  // Tier 2: iron-bound
  { hull: '#424040', trim: '#787272' },  // Tier 3: ironclad
  { hull: '#3a3a3e', trim: '#686870' }   // Tier 4: steel
];

/**
 * Build the upgrade catalog from the raw JSON descriptor.
 * Filters out MP-cut upgrades.
 *
 * @param {object} rawJson - Parsed data/upgrades.json
 * @returns {{ standard: Array, major: Array, byId: Map, baseline: object }}
 */
export function buildMpCatalog(rawJson) {
  const catalog = createUpgradeCatalog(rawJson);

  // Filter out cut upgrades
  catalog.standard = catalog.standard.filter(u => !MP_CUT_IDS.has(u.id));
  catalog.major = catalog.major.filter(u => !MP_CUT_IDS.has(u.id));

  // Rebuild byId
  catalog.byId = new Map([...catalog.standard, ...catalog.major].map(u => [u.id, u]));

  // Attach baseline for reference
  catalog.baseline = rawJson.baseline || {};

  return catalog;
}

/**
 * Apply a single upgrade (by ID) to a ship.
 * Uses the rule engine with MP-compatible environment hooks.
 *
 * @param {object} ship     - Ship state (mutated in place)
 * @param {string} upgradeId - ID from the catalog
 * @param {object} catalog   - From buildMpCatalog
 * @returns {{ success: boolean, trace: Array }}
 */
export function applyUpgrade(ship, upgradeId, catalog) {
  const upgrade = catalog.byId.get(upgradeId);
  if (!upgrade) return { success: false, trace: [] };

  // Build the root state object the rule engine expects
  const rootState = {
    player: ship,
    state: {
      goldMagnetBonus: 0   // unused in MP, but rule engine may reference it
    }
  };

  // Environment hooks
  const env = {
    autoInstallCannons: (entity, perSide) => autoInstallCannons(entity, perSide),
    autoInstallGuns: (entity, perSide) => autoInstallGuns(entity, perSide),
    ensureRepairCrew: (entity) => {
      entity.crew = (entity.crew || 0) + 1;
      entity.repairCrew = (entity.repairCrew || 0) + 1;
    },
    clampArmament: (rootState) => {
      clampArmamentToHull(rootState.player);
    },
    clampHpToMax: (rootState) => {
      rootState.player.hp = Math.min(rootState.player.hp, rootState.player.maxHp);
    },
    applyHullArmorVisualTier: (rootState) => {
      const tier = clamp(rootState.player.hullArmorTier || 0, 0, ARMOR_COLORS.length - 1);
      rootState.player.hullColor = ARMOR_COLORS[tier].hull;
      rootState.player.trimColor = ARMOR_COLORS[tier].trim;
    },
    postApply: (rootState) => {
      // Ensure weapon layout is normalized after any upgrade
      normalizeWeaponLayout(rootState.player);
      syncArmamentDerivedStats(rootState.player);
    }
  };

  const trace = applyUpgradeRuleSet(rootState, upgrade.rules, { env });

  // Track upgrade
  if (!Array.isArray(ship.upgrades)) ship.upgrades = [];
  ship.upgrades.push(upgradeId);

  return { success: true, trace };
}

/**
 * Pick N random upgrades from a pool, avoiding duplicates where it makes sense.
 * For standard upgrades, any upgrade can be picked multiple times (stacks).
 * Returns array of upgrade objects.
 *
 * @param {'standard'|'major'} pool
 * @param {number} count
 * @param {object} catalog
 * @returns {Array}
 */
export function rollUpgradeOffer(pool, count, catalog) {
  const source = pool === 'major' ? catalog.major : catalog.standard;
  if (source.length === 0) return [];

  // Pick random with some variety (try not to offer 3 of the same)
  const picks = [];
  const attempts = count * 4;
  for (let i = 0; i < attempts && picks.length < count; i++) {
    const candidate = source[Math.floor(Math.random() * source.length)];
    // Allow duplicates but try to avoid back-to-back identical
    if (picks.length > 0 && picks[picks.length - 1].id === candidate.id) continue;
    picks.push(candidate);
  }

  // Fill remaining if we're short
  while (picks.length < count && source.length > 0) {
    picks.push(source[Math.floor(Math.random() * source.length)]);
  }

  return picks;
}

/**
 * Apply N random upgrades to a ship (used for NPC difficulty scaling).
 * Each upgrade is a random standard upgrade.
 *
 * @param {object} ship
 * @param {number} count   - Number of random upgrades to apply
 * @param {object} catalog
 */
export function applyRandomUpgrades(ship, count, catalog) {
  for (let i = 0; i < count; i++) {
    const pool = catalog.standard;
    if (pool.length === 0) break;
    const upgrade = pool[Math.floor(Math.random() * pool.length)];
    applyUpgrade(ship, upgrade.id, catalog);
  }
}
