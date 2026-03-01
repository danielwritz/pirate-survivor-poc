import { describe, expect, it, vi } from 'vitest';
import { applyUpgradeRuleSet, createUpgradeCatalog } from '../src/systems/upgradeRuleEngine.js';

describe('upgradeRuleEngine', () => {
  it('applies numeric and semantic operations with trace output', () => {
    const state = {
      player: {
        gunReload: 1,
        slots: [],
        crew: 2,
        repairCrew: 0,
        weaponLayout: { port: [], starboard: [] }
      }
    };

    const autoInstallCannons = vi.fn();
    const ensureRepairCrew = vi.fn((player) => {
      player.repairCrew = 1;
      player.crew = Math.max(player.crew, 3);
    });

    const trace = applyUpgradeRuleSet(state, [
      { op: 'add', path: 'player.gunReload', value: -0.2 },
      { op: 'clamp', path: 'player.gunReload', min: 0.9, max: 2 },
      { op: 'addAbility', value: 'Cannons' },
      { op: 'autoInstallCannons', perSide: 1 },
      { op: 'ensureRepairCrew' },
      { op: 'call', fn: 'customHook' }
    ], {
      env: {
        autoInstallCannons,
        ensureRepairCrew,
        customHook: vi.fn()
      }
    });

    expect(state.player.gunReload).toBe(0.9);
    expect(state.player.slots).toEqual(['Cannons']);
    expect(state.player.repairCrew).toBe(1);
    expect(autoInstallCannons).toHaveBeenCalledWith(state.player, 1);
    expect(ensureRepairCrew).toHaveBeenCalledWith(state.player);
    expect(trace.length).toBe(6);
    expect(trace[0].op).toBe('add');
  });

  it('builds catalog from descriptor lists', () => {
    const descriptor = {
      standard: [{ id: 'a' }, { id: 'b' }],
      major: [{ id: 'm1' }]
    };
    const catalog = createUpgradeCatalog(descriptor);
    expect(catalog.standard).toHaveLength(2);
    expect(catalog.major).toHaveLength(1);
    expect(catalog.byId.get('m1')).toEqual({ id: 'm1' });
  });
});
