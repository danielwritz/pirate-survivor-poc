/**
 * Scenario: towers_inactive_during_calm_waters (weight 2)
 *
 * During Calm Waters (0–119s), island towers must NOT fire at players.
 * Once stage transitions to Contested Seas (120s+), towers become active.
 *
 * Tests tickTowers() directly with controlled inputs.
 */

import { createWorldState, tickTowers } from '../../../server/worldManager.js';

const checks = [];

// ─── Build a world state with a tower that is primed and ready to fire ────────
function buildWorldWithPrimedTower() {
  // Seed 42 gives a deterministic world
  const ws = createWorldState(42);

  // Push a custom island with a primed tower on it
  ws.islands.push({
    x: 500,
    y: 500,
    radius: 80,
    buildings: [
      {
        x: 500,
        y: 500,
        isTower: true,
        destroyed: false,
        hp: 100,
        maxHp: 100,
        size: 12,
        towerTimer: 99  // very high — immediately fires
      }
    ]
  });

  return ws;
}

// A player ship sitting on top of the tower (well within range)
const playerOnTower = [{ alive: true, x: 500, y: 510 }];
// A player ship far away (outside range) as control
const playerFarAway = [{ alive: true, x: 3000, y: 3000 }];

// ─── Test 1: Towers silent during Calm Waters (various times 0–119s) ──────────
for (const t of [0, 30, 60, 90, 119]) {
  const ws = buildWorldWithPrimedTower();
  const bullets = [];
  tickTowers(ws, playerOnTower, 2, 0.1, b => bullets.push(b), t);
  checks.push({
    check: `towers do NOT fire at roundTime=${t}s (calm waters)`,
    passed: bullets.length === 0
  });
}

// ─── Test 2: Towers fire during Contested Seas (120s+) ───────────────────────
for (const t of [120, 150, 200, 250, 299]) {
  const ws = buildWorldWithPrimedTower();
  const bullets = [];
  tickTowers(ws, playerOnTower, 2, 0.1, b => bullets.push(b), t);
  checks.push({
    check: `towers DO fire at roundTime=${t}s (contested seas)`,
    passed: bullets.length > 0
  });
}

// ─── Test 3: Towers fire during War Zone ─────────────────────────────────────
{
  const ws = buildWorldWithPrimedTower();
  const bullets = [];
  tickTowers(ws, playerOnTower, 3, 0.1, b => bullets.push(b), 350);
  checks.push({ check: 'towers fire at roundTime=350s (war zone)', passed: bullets.length > 0 });
}

// ─── Test 4: Towers fire during Kraken Frontier ──────────────────────────────
{
  const ws = buildWorldWithPrimedTower();
  const bullets = [];
  tickTowers(ws, playerOnTower, 5, 0.1, b => bullets.push(b), 500);
  checks.push({ check: 'towers fire at roundTime=500s (kraken frontier)', passed: bullets.length > 0 });
}

// ─── Test 5: Towers do not fire even in calm waters with defenseLevel=5 ──────
{
  const ws = buildWorldWithPrimedTower();
  const bullets = [];
  tickTowers(ws, playerOnTower, 5, 0.1, b => bullets.push(b), 60);
  checks.push({ check: 'towers silent in calm waters even with defenseLevel=5', passed: bullets.length === 0 });
}

// ─── Test 6: Exact boundary — roundTime=119 is still calm waters (no fire) ───
{
  const ws = buildWorldWithPrimedTower();
  const bullets = [];
  tickTowers(ws, playerOnTower, 1, 0.1, b => bullets.push(b), 119);
  checks.push({ check: 'towers silent at exact boundary roundTime=119s', passed: bullets.length === 0 });
}

// ─── Test 7: Exact boundary — roundTime=120 is contested seas (fire!) ────────
{
  const ws = buildWorldWithPrimedTower();
  const bullets = [];
  tickTowers(ws, playerOnTower, 1, 0.1, b => bullets.push(b), 120);
  checks.push({ check: 'towers fire at exact boundary roundTime=120s', passed: bullets.length > 0 });
}

const allPassed = checks.every(c => c.passed);
const calmSilentPassed = checks.slice(0, 5).every(c => c.passed);
const contestedActivePassed = checks.slice(5, 10).every(c => c.passed);

let result;
if (allPassed) {
  result = 'pass';
} else if (calmSilentPassed || contestedActivePassed) {
  result = 'partial';
} else {
  result = 'fail';
}

const failedChecks = checks.filter(c => !c.passed);

console.log(JSON.stringify({
  scenario: 'towers_inactive_during_calm_waters',
  result,
  details: allPassed
    ? 'All tower silence/activation checks passed'
    : `${failedChecks.length} check(s) failed: ${failedChecks.map(c => c.check).join('; ')}`,
  checks
}, null, 2));
