/**
 * Scenario: review_towers_silent_during_calm (weight: 4)
 * Towers must not fire during Calm Waters, but must fire during Contested Seas.
 */
import { createWorldState, tickTowers } from '../../server/worldManager.js';

const failures = [];

// Create a minimal world with at least one island that has towers
// We need a roundConfig-like shape and seed for createWorldState
const roundConfig = {
  worldWidth: 3000,
  worldHeight: 2100,
  islandCount: 3,
  islandRadius: 100,
  islandSpacing: 300,
  towerCount: 2,
  towerRange: 500,
  towerDamage: 10,
  towerFireRate: 1,
  buildingCount: 2,
  buildingHp: 100
};

let worldState;
try {
  worldState = createWorldState(12345, roundConfig);
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `createWorldState failed: ${e.message}` }));
  process.exit(0);
}

// Find an island with towers and place a fake ship within range
const islandWithTower = worldState.islands?.find(i => i.towers && i.towers.length > 0);
if (!islandWithTower) {
  // If no towers in created world, the test can't run but that's a problem
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: 'No towers found in created world state — cannot verify tower silence' }));
  process.exit(0);
}

const tower = islandWithTower.towers[0];
const fakeShip = {
  x: tower.x + 50,  // within range
  y: tower.y + 50,
  hp: 100,
  maxHp: 100,
  radius: 20,
  id: 'test-ship',
  isNpc: false
};

// Tick at Calm Waters (t=60) — should produce zero bullets
const calmBullets = [];
try {
  tickTowers(worldState, [fakeShip], 0, 5.0, (b) => calmBullets.push(b), 60);
} catch (e) {
  // tickTowers might not accept roundTime param if not implemented
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `tickTowers(roundTime=60) threw: ${e.message}` }));
  process.exit(0);
}

if (calmBullets.length > 0) {
  failures.push(`Calm Waters (t=60): expected 0 bullets, got ${calmBullets.length}`);
}

// Also check t=119 (last second of Calm)
const calmBullets2 = [];
// Reset tower cooldowns
if (worldState.islands) {
  for (const island of worldState.islands) {
    for (const t of (island.towers || [])) {
      if (t.cooldown !== undefined) t.cooldown = 0;
    }
  }
}
try {
  tickTowers(worldState, [fakeShip], 0, 5.0, (b) => calmBullets2.push(b), 119);
} catch { /* ignore */ }

if (calmBullets2.length > 0) {
  failures.push(`Calm Waters (t=119): expected 0 bullets, got ${calmBullets2.length}`);
}

// Tick at Contested Seas (t=130) — should produce at least one bullet
// Reset cooldowns again
if (worldState.islands) {
  for (const island of worldState.islands) {
    for (const t of (island.towers || [])) {
      if (t.cooldown !== undefined) t.cooldown = 0;
    }
  }
}
const contestedBullets = [];
try {
  tickTowers(worldState, [fakeShip], 0, 5.0, (b) => contestedBullets.push(b), 130);
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `tickTowers(roundTime=130) threw: ${e.message}` }));
  process.exit(0);
}

if (contestedBullets.length === 0) {
  failures.push('Contested Seas (t=130): expected tower bullets, got 0');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Towers silent during Calm, active during Contested' }));
} else if (failures.length === 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
