import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';

const UPGRADE_FILE = new URL('../data/upgrades.json', import.meta.url);

async function loadCatalog() {
  const raw = await readFile(UPGRADE_FILE, 'utf8');
  return JSON.parse(raw);
}

describe('upgrades catalog', () => {
  it('has unique upgrade IDs across standard and major pools', async () => {
    const catalog = await loadCatalog();
    const ids = [...catalog.standard, ...catalog.major].map((u) => u.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('includes the new fun standard upgrades for multiplayer variety', async () => {
    const catalog = await loadCatalog();
    const ids = new Set((catalog.standard || []).map((u) => u.id));

    expect(ids.has('powder-magazines')).toBe(true);
    expect(ids.has('boarding-drums')).toBe(true);
    expect(ids.has('quartermaster-stores')).toBe(true);
    expect(ids.has('reef-runner')).toBe(true);
  });
});
