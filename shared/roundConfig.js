import { clamp } from '../src/core/math.js';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAX_NPCS,
  NPC_SPAWN_INTERVAL_BASE,
  ISLAND_COUNT
} from './constants.js';

const DEFAULT_RESULTS_DURATION = 20;
const DEFAULT_ISLAND_MARGIN = 200;
const DEFAULT_ISLAND_SPACING = 280;
const DEFAULT_ISLAND_SIZE_SCALE = 1;

function asFiniteNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function sanitizeRoundConfig(baseConfig = {}) {
  return {
    worldWidth: Math.round(clamp(asFiniteNumber(baseConfig.worldWidth, WORLD_WIDTH), 1800, 5200)),
    worldHeight: Math.round(clamp(asFiniteNumber(baseConfig.worldHeight, WORLD_HEIGHT), 1400, 4200)),
    enemyCap: Math.round(clamp(asFiniteNumber(baseConfig.enemyCap, MAX_NPCS), 6, 48)),
    enemySpawnIntervalBase: Math.round(clamp(asFiniteNumber(baseConfig.enemySpawnIntervalBase, NPC_SPAWN_INTERVAL_BASE), 2.1, 6) * 100) / 100,
    islandCount: Math.round(clamp(asFiniteNumber(baseConfig.islandCount, ISLAND_COUNT), 4, 40)),
    islandMargin: Math.round(clamp(asFiniteNumber(baseConfig.islandMargin, DEFAULT_ISLAND_MARGIN), 120, 320)),
    islandSpacing: Math.round(clamp(asFiniteNumber(baseConfig.islandSpacing, DEFAULT_ISLAND_SPACING), 180, 460)),
    islandSizeScale: Math.round(clamp(asFiniteNumber(baseConfig.islandSizeScale, DEFAULT_ISLAND_SIZE_SCALE), 0.65, 1.45) * 100) / 100
  };
}

function normalizeChoice(choice) {
  const choiceId = typeof choice?.id === 'string' && choice.id ? choice.id : null;
  if (!choiceId) return null;
  return {
    id: choiceId,
    label: typeof choice?.label === 'string' && choice.label ? choice.label : choiceId,
    effects: choice?.effects && typeof choice.effects === 'object' ? { ...choice.effects } : {}
  };
}

function normalizeCategory(category) {
  const categoryId = typeof category?.id === 'string' && category.id ? category.id : null;
  if (!categoryId) return null;

  const choices = Array.isArray(category?.choices)
    ? category.choices.map(normalizeChoice).filter(Boolean)
    : [];

  if (choices.length === 0) return null;

  const defaultChoiceId = typeof category?.defaultChoiceId === 'string' && choices.some((choice) => choice.id === category.defaultChoiceId)
    ? category.defaultChoiceId
    : (choices.find((choice) => choice.id === 'normal')?.id || choices[0].id);

  return {
    id: categoryId,
    label: typeof category?.label === 'string' && category.label ? category.label : categoryId,
    defaultChoiceId,
    choices
  };
}

export function normalizeRoundCatalog(raw = {}) {
  const voteCategories = Array.isArray(raw?.voteCategories)
    ? raw.voteCategories.map(normalizeCategory).filter(Boolean)
    : [];

  return {
    schemaVersion: Math.max(1, Math.floor(asFiniteNumber(raw?.schemaVersion, 1))),
    resultsDuration: Math.round(clamp(asFiniteNumber(raw?.resultsDuration, DEFAULT_RESULTS_DURATION), 12, 45)),
    baseConfig: sanitizeRoundConfig(raw?.baseConfig || {}),
    voteCategories
  };
}

function buildTallies(catalog, selections = {}) {
  const tallies = {};

  for (const category of catalog.voteCategories) {
    tallies[category.id] = Object.fromEntries(category.choices.map((choice) => [choice.id, 0]));
  }

  for (const perPlayer of Object.values(selections)) {
    if (!perPlayer || typeof perPlayer !== 'object') continue;
    for (const category of catalog.voteCategories) {
      const choiceId = perPlayer[category.id];
      if (choiceId && tallies[category.id] && Object.hasOwn(tallies[category.id], choiceId)) {
        tallies[category.id][choiceId] += 1;
      }
    }
  }

  return tallies;
}

function resolveWinningChoices(catalog, tallies) {
  const winners = {};

  for (const category of catalog.voteCategories) {
    const categoryTallies = tallies[category.id] || {};
    let bestCount = 0;
    let contenders = [];

    for (const choice of category.choices) {
      const count = categoryTallies[choice.id] || 0;
      if (count > bestCount) {
        bestCount = count;
        contenders = [choice.id];
      } else if (count === bestCount) {
        contenders.push(choice.id);
      }
    }

    if (bestCount <= 0) {
      winners[category.id] = category.defaultChoiceId;
      continue;
    }

    winners[category.id] = contenders.length === 1 ? contenders[0] : category.defaultChoiceId;
  }

  return winners;
}

function applyRoundEffects(baseConfig, effects = {}) {
  const next = { ...baseConfig };

  if (Number.isFinite(effects.worldScale)) {
    next.worldWidth *= effects.worldScale;
    next.worldHeight *= effects.worldScale;
    next.islandMargin *= effects.worldScale;
    next.islandSpacing *= effects.worldScale;
  }
  if (Number.isFinite(effects.enemyCapDelta)) next.enemyCap += effects.enemyCapDelta;
  if (Number.isFinite(effects.enemySpawnIntervalDelta)) next.enemySpawnIntervalBase += effects.enemySpawnIntervalDelta;
  if (Number.isFinite(effects.islandCountDelta)) next.islandCount += effects.islandCountDelta;
  if (Number.isFinite(effects.islandSpacingDelta)) next.islandSpacing += effects.islandSpacingDelta;
  if (Number.isFinite(effects.islandMarginDelta)) next.islandMargin += effects.islandMarginDelta;
  if (Number.isFinite(effects.islandSizeScaleMul)) next.islandSizeScale *= effects.islandSizeScaleMul;

  return next;
}

export function resolveRoundConfig(catalog, voteState = null) {
  const normalizedCatalog = normalizeRoundCatalog(catalog);
  const tallies = buildTallies(normalizedCatalog, voteState?.selections || {});
  const winners = resolveWinningChoices(normalizedCatalog, tallies);

  let nextConfig = { ...normalizedCatalog.baseConfig };
  for (const category of normalizedCatalog.voteCategories) {
    const winningChoiceId = winners[category.id] || category.defaultChoiceId;
    const choice = category.choices.find((entry) => entry.id === winningChoiceId);
    nextConfig = applyRoundEffects(nextConfig, choice?.effects || {});
  }

  return sanitizeRoundConfig(nextConfig);
}

export function createRoundVoteState(catalog, active = false) {
  const normalizedCatalog = normalizeRoundCatalog(catalog);
  const tallies = buildTallies(normalizedCatalog, {});
  const winners = resolveWinningChoices(normalizedCatalog, tallies);
  return {
    active: !!active,
    selections: {},
    tallies,
    winners,
    nextRoundConfig: resolveRoundConfig(normalizedCatalog, { selections: {} })
  };
}

function rebuildVoteState(catalog, selections, active) {
  const normalizedCatalog = normalizeRoundCatalog(catalog);
  const tallies = buildTallies(normalizedCatalog, selections);
  const winners = resolveWinningChoices(normalizedCatalog, tallies);
  return {
    active: !!active,
    selections,
    tallies,
    winners,
    nextRoundConfig: resolveRoundConfig(normalizedCatalog, { selections })
  };
}

export function submitRoundVote(catalog, voteState, playerId, categoryId, choiceId) {
  const normalizedCatalog = normalizeRoundCatalog(catalog);
  const category = normalizedCatalog.voteCategories.find((entry) => entry.id === categoryId);
  if (!category) return voteState;
  if (!category.choices.some((choice) => choice.id === choiceId)) return voteState;

  const nextSelections = { ...(voteState?.selections || {}) };
  const playerKey = String(playerId);
  nextSelections[playerKey] = {
    ...(nextSelections[playerKey] || {}),
    [categoryId]: choiceId
  };

  return rebuildVoteState(normalizedCatalog, nextSelections, voteState?.active);
}

export function removeRoundVotesForPlayer(catalog, voteState, playerId) {
  const playerKey = String(playerId);
  if (!voteState?.selections || !Object.hasOwn(voteState.selections, playerKey)) return voteState;

  const nextSelections = { ...voteState.selections };
  delete nextSelections[playerKey];
  return rebuildVoteState(catalog, nextSelections, voteState?.active);
}