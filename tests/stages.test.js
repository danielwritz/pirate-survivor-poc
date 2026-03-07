/**
 * tests/stages.test.js
 *
 * Covers all 5 acceptance scenarios from Story 6 (Named Difficulty Stages):
 *   - stage_transition_calm_to_contested
 *   - stage_transition_contested_to_warzone
 *   - stage_transition_warzone_to_kraken
 *   - calm_waters_weak_npcs_only
 *   - towers_inactive_during_calm_waters
 */

import { describe, expect, it, vi } from 'vitest';
import {
  getCurrentStage,
  getAllowedArchetypes,
  STAGE_CALM_WATERS,
  STAGE_CONTESTED_SEAS,
  STAGE_WAR_ZONE,
  STAGE_KRAKEN_FRONTIER
} from '../shared/stages.js';
import { rollNpcArchetype } from '../server/npcDirector.js';
import { createWorldState, tickTowers } from '../server/worldManager.js';

// ─── Stage boundary tests ───────────────────────────────────────────────

describe('getCurrentStage — stage boundaries', () => {
  it('stage_transition_calm_to_contested: at 120s stage is contested_seas', () => {
    expect(getCurrentStage(119)).toBe(STAGE_CALM_WATERS);
    expect(getCurrentStage(120)).toBe(STAGE_CONTESTED_SEAS);
    expect(getCurrentStage(121)).toBe(STAGE_CONTESTED_SEAS);
  });

  it('stage_transition_contested_to_warzone: at 300s stage is war_zone', () => {
    expect(getCurrentStage(299)).toBe(STAGE_CONTESTED_SEAS);
    expect(getCurrentStage(300)).toBe(STAGE_WAR_ZONE);
    expect(getCurrentStage(301)).toBe(STAGE_WAR_ZONE);
  });

  it('stage_transition_warzone_to_kraken: at 480s stage is kraken_frontier', () => {
    expect(getCurrentStage(479)).toBe(STAGE_WAR_ZONE);
    expect(getCurrentStage(480)).toBe(STAGE_KRAKEN_FRONTIER);
    expect(getCurrentStage(600)).toBe(STAGE_KRAKEN_FRONTIER);
  });

  it('returns calm_waters for time 0', () => {
    expect(getCurrentStage(0)).toBe(STAGE_CALM_WATERS);
  });
});

// ─── NPC archetype pool filtering ───────────────────────────────────────

describe('calm_waters_weak_npcs_only: NPC archetype pool per stage', () => {
  it('calm waters only allows weak and standard archetypes', () => {
    const pool = getAllowedArchetypes(0);
    expect(pool).toContain('weak');
    expect(pool).toContain('standard');
    expect(pool).not.toContain('heavy');
    expect(pool).not.toContain('scavenger');
  });

  it('contested seas adds heavy archetypes', () => {
    const pool = getAllowedArchetypes(120);
    expect(pool).toContain('weak');
    expect(pool).toContain('standard');
    expect(pool).toContain('heavy');
    expect(pool).not.toContain('scavenger');
  });

  it('war zone adds scavenger archetypes', () => {
    const pool = getAllowedArchetypes(300);
    expect(pool).toContain('weak');
    expect(pool).toContain('standard');
    expect(pool).toContain('heavy');
    expect(pool).toContain('scavenger');
  });

  it('rollNpcArchetype with calm_waters pool never returns heavy or scavenger', () => {
    const calmPool = getAllowedArchetypes(60);
    // Try many random rolls — none should produce a heavy or scavenger
    for (let i = 0; i < 200; i++) {
      const archetype = rollNpcArchetype(Math.random(), calmPool);
      expect(['weak', 'standard']).toContain(archetype);
    }
  });

  it('rollNpcArchetype with no pool restriction still returns all four archetypes over time', () => {
    const results = new Set();
    for (let i = 0; i < 500; i++) {
      results.add(rollNpcArchetype(Math.random()));
    }
    expect(results.has('weak')).toBe(true);
    expect(results.has('standard')).toBe(true);
    expect(results.has('heavy')).toBe(true);
    expect(results.has('scavenger')).toBe(true);
  });
});

// ─── Tower silence during Calm Waters ──────────────────────────────────

describe('towers_inactive_during_calm_waters', () => {
  function buildWorldStateWithTower() {
    // Use a deterministic seed so we get a consistent world layout
    const ws = createWorldState(42);
    // Manually add a tower building close to origin for easy testing
    if (!ws.islands || ws.islands.length === 0) {
      ws.islands = [];
    }
    ws.islands.push({
      x: 100,
      y: 100,
      radius: 60,
      buildings: [
        {
          x: 100,
          y: 100,
          isTower: true,
          destroyed: false,
          hp: 50,
          size: 10,
          towerTimer: 99 // already ready to fire
        }
      ]
    });
    return ws;
  }

  it('towers do NOT fire during Calm Waters (roundTime = 60)', () => {
    const ws = buildWorldStateWithTower();
    const ships = [{ alive: true, x: 100, y: 100 }]; // ship right on the tower
    const fired = [];
    tickTowers(ws, ships, 1, 0.05, (bullet) => fired.push(bullet), 60 /* calm waters */);
    expect(fired.length).toBe(0);
  });

  it('towers DO fire during Contested Seas (roundTime = 150)', () => {
    const ws = buildWorldStateWithTower();
    const ships = [{ alive: true, x: 100, y: 100 }];
    const fired = [];
    tickTowers(ws, ships, 1, 0.05, (bullet) => fired.push(bullet), 150 /* contested */);
    expect(fired.length).toBeGreaterThan(0);
  });

  it('towers DO fire during War Zone (roundTime = 350)', () => {
    const ws = buildWorldStateWithTower();
    const ships = [{ alive: true, x: 100, y: 100 }];
    const fired = [];
    tickTowers(ws, ships, 1, 0.05, (bullet) => fired.push(bullet), 350 /* war zone */);
    expect(fired.length).toBeGreaterThan(0);
  });
});
