import { describe, expect, it } from 'vitest';
import { createKrakenBoss, tickKrakenBoss } from '../server/bossDirector.js';
import { KRAKEN_AREA_RADIUS, KRAKEN_PULSE_INTERVAL } from '../shared/constants.js';

function makeShip(id, x, y, hp = 100) {
  return { id, x, y, hp, alive: true };
}

describe('Kraken boss archetype', () => {
  it('creates a kraken with area effect active and radius >= 150', () => {
    const boss = createKrakenBoss(500, 500, 8);
    expect(boss.archetype).toBe('kraken');
    expect(boss.areaEffect.active).toBe(true);
    expect(boss.areaEffect.radius).toBeGreaterThanOrEqual(150);
  });

  it('KRAKEN_AREA_RADIUS constant is >= 150', () => {
    expect(KRAKEN_AREA_RADIUS).toBeGreaterThanOrEqual(150);
  });

  it('scales HP with tier', () => {
    const t0 = createKrakenBoss(0, 0, 0);
    const t8 = createKrakenBoss(0, 0, 8);
    expect(t8.maxHp).toBeGreaterThan(t0.maxHp);
  });

  it('emits areaDenial event on pulse', () => {
    const boss = createKrakenBoss(0, 0, 8);
    const events = [];
    tickKrakenBoss(boss, [], KRAKEN_PULSE_INTERVAL, events);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('areaDenial');
    expect(events[0].id).toBe(boss.id);
  });

  it('deals damage to ships within the hazard radius', () => {
    const boss = createKrakenBoss(0, 0, 8);
    const ship = makeShip(1, boss.areaEffect.radius - 1, 0);
    const initialHp = ship.hp;
    const events = [];
    tickKrakenBoss(boss, [ship], KRAKEN_PULSE_INTERVAL, events);
    expect(ship.hp).toBeLessThan(initialHp);
  });

  it('does not damage ships outside the hazard radius', () => {
    const boss = createKrakenBoss(0, 0, 8);
    const ship = makeShip(2, boss.areaEffect.radius + 1, 0);
    const initialHp = ship.hp;
    const events = [];
    tickKrakenBoss(boss, [ship], KRAKEN_PULSE_INTERVAL, events);
    expect(ship.hp).toBe(initialHp);
  });

  it('does not pulse before interval elapses', () => {
    const boss = createKrakenBoss(0, 0, 8);
    const ship = makeShip(3, 0, 0);
    const initialHp = ship.hp;
    const events = [];
    tickKrakenBoss(boss, [ship], KRAKEN_PULSE_INTERVAL * 0.5, events);
    expect(events.length).toBe(0);
    expect(ship.hp).toBe(initialHp);
  });

  it('does nothing when boss is dead', () => {
    const boss = createKrakenBoss(0, 0, 8);
    boss.alive = false;
    const ship = makeShip(4, 0, 0);
    const initialHp = ship.hp;
    const events = [];
    tickKrakenBoss(boss, [ship], KRAKEN_PULSE_INTERVAL, events);
    expect(events.length).toBe(0);
    expect(ship.hp).toBe(initialHp);
  });

  it('skips dead ships during pulse', () => {
    const boss = createKrakenBoss(0, 0, 8);
    const ship = makeShip(5, 0, 0);
    ship.alive = false;
    const initialHp = ship.hp;
    const events = [];
    tickKrakenBoss(boss, [ship], KRAKEN_PULSE_INTERVAL, events);
    // event still emitted (boss is alive), but dead ship is unharmed
    expect(ship.hp).toBe(initialHp);
  });
});
