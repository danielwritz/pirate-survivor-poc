/**
 * Scenario: review_towers_silent_during_calm
 * Verifies that towers do NOT fire during Calm Waters (t<120) and DO fire after.
 */
import { createWorldState, tickTowers } from '../../../server/worldManager.js';

const checks = [];

/**
 * Build a world state with a deterministic tower placed close to origin.
 * The tower's towerTimer is set high so it will fire immediately.
 */
function buildWorldStateWithReadyTower() {
  const ws = createWorldState(42);
  // Ensure we have at least one island with a ready tower near origin
  if (!ws.islands) ws.islands = [];
  ws.islands.push({
    x: 150,
    y: 150,
    radius: 60,
    buildings: [
      {
        x: 150,
        y: 150,
        isTower: true,
        destroyed: false,
        hp: 100,
        size: 10,
        towerTimer: 9999 // already past fire interval — ready to fire immediately
      }
    ]
  });
  return ws;
}

// Ship positioned right on top of the tower so range check always passes
const ships = [{ alive: true, x: 150, y: 150 }];

// ── Test 1: t=60 (Calm Waters) ─ towers should NOT fire
{
  const ws = buildWorldStateWithReadyTower();
  const fired = [];
  tickTowers(ws, ships, 1, 0.05, (b) => fired.push(b), 60);
  checks.push({
    check: 'At t=60 (Calm Waters): zero tower bullets created',
    passed: fired.length === 0,
    actual: fired.length
  });
}

// ── Test 2: t=119 (last second of Calm) ─ towers still silent
{
  const ws = buildWorldStateWithReadyTower();
  const fired = [];
  tickTowers(ws, ships, 1, 0.05, (b) => fired.push(b), 119);
  checks.push({
    check: 'At t=119 (last second of Calm): zero tower bullets',
    passed: fired.length === 0,
    actual: fired.length
  });
}

// ── Test 3: t=120 (first second of Contested) ─ towers should activate
{
  const ws = buildWorldStateWithReadyTower();
  const fired = [];
  tickTowers(ws, ships, 1, 0.05, (b) => fired.push(b), 120);
  checks.push({
    check: 'At t=120 (Contested Seas): at least one tower bullet created',
    passed: fired.length > 0,
    actual: fired.length
  });
}

// ── Test 4: t=130 (Contested Seas, mid-stage) ─ towers should fire
{
  const ws = buildWorldStateWithReadyTower();
  const fired = [];
  tickTowers(ws, ships, 1, 0.05, (b) => fired.push(b), 130);
  checks.push({
    check: 'At t=130 (Contested Seas): at least one tower bullet',
    passed: fired.length > 0,
    actual: fired.length
  });
}

// ── Test 5: t=350 (War Zone) ─ towers fire
{
  const ws = buildWorldStateWithReadyTower();
  const fired = [];
  tickTowers(ws, ships, 1, 0.05, (b) => fired.push(b), 350);
  checks.push({
    check: 'At t=350 (War Zone): towers fire',
    passed: fired.length > 0,
    actual: fired.length
  });
}

// ── Test 6: t=500 (Kraken Frontier) ─ towers fire
{
  const ws = buildWorldStateWithReadyTower();
  const fired = [];
  tickTowers(ws, ships, 1, 0.05, (b) => fired.push(b), 500);
  checks.push({
    check: 'At t=500 (Kraken Frontier): towers fire',
    passed: fired.length > 0,
    actual: fired.length
  });
}

const allPassed = checks.every(c => c.passed);
const failedChecks = checks.filter(c => !c.passed);

console.log(JSON.stringify({
  scenario: 'review_towers_silent_during_calm',
  result: allPassed ? 'pass' : failedChecks.length <= 2 ? 'partial' : 'fail',
  details: allPassed
    ? `All ${checks.length} tower activation checks passed`
    : `${failedChecks.length} checks failed: ${failedChecks.map(c => c.check).join('; ')}`,
  checks
}, null, 2));
