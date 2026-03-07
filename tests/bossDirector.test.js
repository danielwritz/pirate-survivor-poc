import { describe, expect, it } from 'vitest';
import {
  createBossDirector,
  tickBossDirector,
  onBossDefeated,
  getBossDisplayName,
  BOSS_ARCHETYPES
} from '../server/bossDirector.js';

const WORLD = { width: 3000, height: 2100 };
const DT = 1 / 20; // one tick

function runTicks(bd, fromTime, toTime, world = WORLD) {
  const events = [];
  for (let t = fromTime; t <= toTime; t += DT) {
    tickBossDirector(bd, t, DT, world, events);
  }
  return events;
}

describe('boss director', () => {
  it('emits a bossSpawn event with correct fields when roundTime crosses the first scheduled spawn', () => {
    const bd = createBossDirector();
    const events = [];

    // Tick just before first spawn threshold (150 s) — no event yet
    tickBossDirector(bd, 149.9, DT, WORLD, events);
    expect(events).toHaveLength(0);

    // Tick at or past 150 s — event must fire
    tickBossDirector(bd, 150.0, DT, WORLD, events);
    expect(events).toHaveLength(1);

    const ev = events[0];
    expect(ev.type).toBe('bossSpawn');
    expect(typeof ev.bossType).toBe('string');
    expect(typeof ev.x).toBe('number');
    expect(typeof ev.y).toBe('number');
  });

  it('includes bossType, x, and y on every bossSpawn event', () => {
    const bd = createBossDirector();
    const events = [];

    // Fast-forward past first two scheduled spawns
    tickBossDirector(bd, 150, DT, WORLD, events);   // boss 1
    // Mark boss defeated so the next one can spawn
    onBossDefeated(bd);
    // Wait out 30-second cooldown, then tick past second spawn at 270 s
    runTicks(bd, 151, 300, WORLD).forEach(e => events.push(e));

    expect(events.length).toBeGreaterThanOrEqual(2);

    for (const ev of events) {
      expect(ev).toMatchObject({
        type: 'bossSpawn',
        bossType: expect.any(String),
        x: expect.any(Number),
        y: expect.any(Number)
      });
    }
  });

  it('first boss is a war_galleon', () => {
    const bd = createBossDirector();
    const events = [];
    tickBossDirector(bd, 150, DT, WORLD, events);
    expect(events[0].bossType).toBe('war_galleon');
  });

  it('only spawns one boss at a time while one is active', () => {
    const bd = createBossDirector();
    const events = [];

    tickBossDirector(bd, 150, DT, WORLD, events);
    expect(events).toHaveLength(1);

    // Without calling onBossDefeated, no second event should appear
    runTicks(bd, 151, 300, WORLD).forEach(e => events.push(e));
    expect(events).toHaveLength(1);
  });

  it('does not emit before the first scheduled time', () => {
    const bd = createBossDirector();
    const events = runTicks(bd, 0, 149, WORLD);
    expect(events).toHaveLength(0);
  });

  it('spawns the boss within world boundaries', () => {
    const bd = createBossDirector();
    const events = [];
    tickBossDirector(bd, 150, DT, WORLD, events);
    const ev = events[0];
    expect(ev.x).toBeGreaterThan(0);
    expect(ev.x).toBeLessThan(WORLD.width);
    expect(ev.y).toBeGreaterThan(0);
    expect(ev.y).toBeLessThan(WORLD.height);
  });

  it('getBossDisplayName returns a human-readable string', () => {
    expect(getBossDisplayName('war_galleon')).toBe('War Galleon');
    expect(getBossDisplayName('fire_ship')).toBe('Fire Ship');
    expect(getBossDisplayName('kraken')).toBe('Kraken');
    // Unknown key falls back to the raw key
    expect(getBossDisplayName('unknown_boss')).toBe('unknown_boss');
  });

  it('BOSS_ARCHETYPES covers war_galleon, fire_ship, and kraken', () => {
    expect(BOSS_ARCHETYPES).toHaveProperty('war_galleon');
    expect(BOSS_ARCHETYPES).toHaveProperty('fire_ship');
    expect(BOSS_ARCHETYPES).toHaveProperty('kraken');
  });

  it('resets correctly after a round — director created fresh spawns again', () => {
    const bd = createBossDirector();
    const events1 = [];
    tickBossDirector(bd, 150, DT, WORLD, events1);
    expect(events1).toHaveLength(1);

    // Simulate round reset by creating a new director
    const bd2 = createBossDirector();
    const events2 = [];
    tickBossDirector(bd2, 150, DT, WORLD, events2);
    expect(events2).toHaveLength(1);
    expect(events2[0].bossType).toBe(events1[0].bossType);
  });
});
