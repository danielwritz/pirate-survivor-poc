import { describe, expect, it } from 'vitest';
import {
  createRoundVoteState,
  normalizeRoundCatalog,
  removeRoundVotesForPlayer,
  resolveRoundConfig,
  submitRoundVote
} from '../shared/roundConfig.js';

const catalog = normalizeRoundCatalog({
  resultsDuration: 20,
  baseConfig: {
    worldWidth: 3000,
    worldHeight: 2100,
    enemyCap: 20,
    enemySpawnIntervalBase: 3.5,
    islandCount: 18,
    islandMargin: 200,
    islandSpacing: 280,
    islandSizeScale: 1
  },
  voteCategories: [
    {
      id: 'enemyDensity',
      defaultChoiceId: 'normal',
      choices: [
        { id: 'more', effects: { enemyCapDelta: 6, enemySpawnIntervalDelta: -0.35 } },
        { id: 'normal', effects: {} },
        { id: 'less', effects: { enemyCapDelta: -6, enemySpawnIntervalDelta: 0.45 } }
      ]
    },
    {
      id: 'mapSize',
      defaultChoiceId: 'normal',
      choices: [
        { id: 'bigger', effects: { worldScale: 1.15 } },
        { id: 'normal', effects: {} },
        { id: 'smaller', effects: { worldScale: 0.85 } }
      ]
    },
    {
      id: 'islandCount',
      defaultChoiceId: 'normal',
      choices: [
        { id: 'more', effects: { islandCountDelta: 4 } },
        { id: 'normal', effects: {} },
        { id: 'less', effects: { islandCountDelta: -4 } }
      ]
    },
    {
      id: 'islandSize',
      defaultChoiceId: 'normal',
      choices: [
        { id: 'bigger', effects: { islandSizeScaleMul: 1.18, islandSpacingDelta: 18 } },
        { id: 'normal', effects: {} },
        { id: 'smaller', effects: { islandSizeScaleMul: 0.84, islandSpacingDelta: -18 } }
      ]
    }
  ]
});

describe('round config voting', () => {
  it('starts from the JSON base config when no votes are present', () => {
    const voteState = createRoundVoteState(catalog, true);
    const nextConfig = resolveRoundConfig(catalog, voteState);

    expect(nextConfig.worldWidth).toBe(3000);
    expect(nextConfig.worldHeight).toBe(2100);
    expect(nextConfig.enemyCap).toBe(20);
    expect(nextConfig.islandCount).toBe(18);
  });

  it('applies winning vote choices into the next-round JSON config', () => {
    let voteState = createRoundVoteState(catalog, true);
    voteState = submitRoundVote(catalog, voteState, 1, 'enemyDensity', 'more');
    voteState = submitRoundVote(catalog, voteState, 2, 'enemyDensity', 'more');
    voteState = submitRoundVote(catalog, voteState, 1, 'mapSize', 'smaller');
    voteState = submitRoundVote(catalog, voteState, 2, 'mapSize', 'smaller');
    voteState = submitRoundVote(catalog, voteState, 3, 'islandCount', 'less');
    voteState = submitRoundVote(catalog, voteState, 4, 'islandCount', 'less');
    voteState = submitRoundVote(catalog, voteState, 2, 'islandSize', 'bigger');

    const nextConfig = resolveRoundConfig(catalog, voteState);

    expect(voteState.winners.enemyDensity).toBe('more');
    expect(voteState.winners.mapSize).toBe('smaller');
    expect(voteState.winners.islandCount).toBe('less');
    expect(nextConfig.enemyCap).toBe(26);
    expect(nextConfig.enemySpawnIntervalBase).toBeLessThan(3.5);
    expect(nextConfig.worldWidth).toBe(2550);
    expect(nextConfig.worldHeight).toBe(1785);
    expect(nextConfig.islandCount).toBe(14);
    expect(nextConfig.islandSizeScale).toBe(1.18);
  });

  it('falls back to the default choice on ties and removes disconnected player votes', () => {
    let voteState = createRoundVoteState(catalog, true);
    voteState = submitRoundVote(catalog, voteState, 1, 'enemyDensity', 'more');
    voteState = submitRoundVote(catalog, voteState, 2, 'enemyDensity', 'less');

    expect(voteState.winners.enemyDensity).toBe('normal');

    voteState = removeRoundVotesForPlayer(catalog, voteState, 2);

    expect(voteState.winners.enemyDensity).toBe('more');
    expect(voteState.tallies.enemyDensity.less).toBe(0);
  });
});