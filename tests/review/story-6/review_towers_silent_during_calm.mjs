/**
 * Scenario: review_towers_silent_during_calm (weight: 4)
 * Towers must not fire during Calm Waters, but must fire during Contested Seas.
 *
 * Villages are globally disabled in world.js, so we inject a tower building
 * manually into a generated island to test the tickTowers code path.
 */
import { createWorldState, tickTowers } from '../../../server/worldManager.js';

const failures = [];

let worldState;
try {
  worldState = createWorldState(12345);
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `createWorldState failed: ${e.message}` }));
  process.exit(0);
}

if (!worldState.islands || worldState.islands.length === 0) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: 'No islands generated — cannot test towers' }));
  process.exit(0);
}

// Inject a tower building into the first island
const island = worldState.islands[0];
const towerBuilding = {
  id: 'test-tower-0',
  x: island.x + 20,
  y: island.y + 20,
  size: 14,
  maxHp: 200,
  hp: 200,
  destroyed: false,
  isTower: true,
  towerTimer: 999  // already past cooldown so it fires immediately
};
island.buildings.push(towerBuilding);

// Place a fake ship within range of the tower
const fakeShip = {
  x: towerBuilding.x + 50,
  y: towerBuilding.y + 50,
  hp: 100,
  maxHp: 100,
  alive: true,
  radius: 20,
  id: 'test-ship',
  isNpc: false
};

// Tick at Calm Waters (t=60) — should produce zero bullets
const calmBullets = [];
try {
  tickTowers(worldState, [fakeShip], 0, 5.0, (b) => calmBullets.push(b), 60);
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `tickTowers(roundTime=60) threw: ${e.message}` }));
  process.exit(0);
}

if (calmBullets.length > 0) {
  failures.push(`Calm Waters (t=60): expected 0 bullets, got ${calmBullets.length}`);
}

// Also check t=119 (last second of Calm)
towerBuilding.towerTimer = 999; // reset so it's ready to fire
const calmBullets2 = [];
try {
  tickTowers(worldState, [fakeShip], 0, 5.0, (b) => calmBullets2.push(b), 119);
} catch { /* ignore */ }

if (calmBullets2.length > 0) {
  failures.push(`Calm Waters (t=119): expected 0 bullets, got ${calmBullets2.length}`);
}

// Tick at Contested Seas (t=130) — should produce at least one bullet
towerBuilding.towerTimer = 999; // reset so it's ready to fire
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
