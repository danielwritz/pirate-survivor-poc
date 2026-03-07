/**
 * Scenario: review_boss_spawns_at_correct_time (weight: 5)
 * The boss director should spawn its first boss around t=150.
 * No boss before t=140, and a boss exists by t=160.
 */
import { createBossDirector, tickBossDirector, isBossAlive } from '../../../server/bossDirector.js';

const failures = [];

const director = createBossDirector();
const world = { width: 3000, height: 2100 };

// 4 players scattered across the map
const players = [
  { x: 500, y: 500, alive: true },
  { x: 2500, y: 500, alive: true },
  { x: 500, y: 1600, alive: true },
  { x: 2500, y: 1600, alive: true }
];

let bossSpawnedBefore140 = false;
let bossExistsBy160 = false;

// Tick from 0 to 160 in 1-second increments
for (let t = 0; t <= 160; t += 1) {
  try {
    tickBossDirector(director, players, world, t, []);
  } catch { /* allow errors from missing subsystems */ }

  if (isBossAlive(director)) {
    if (t < 140) bossSpawnedBefore140 = true;
    if (t <= 160) bossExistsBy160 = true;
  }
}

if (bossSpawnedBefore140) {
  failures.push('Boss spawned before t=140 (too early)');
}

if (!bossExistsBy160) {
  failures.push('No boss existed by t=160 (too late or never spawned)');
}

// Edge: with 0 players, boss should NOT spawn
const directorEmpty = createBossDirector();
for (let t = 0; t <= 200; t += 1) {
  try { tickBossDirector(directorEmpty, [], world, t, []); } catch {}
}
if (isBossAlive(directorEmpty)) {
  failures.push('Boss spawned with 0 players (should require at least 1)');
}

// Edge: with 1 player, boss should still spawn
const directorSolo = createBossDirector();
const solo = [{ x: 1500, y: 1050, alive: true }];
for (let t = 0; t <= 200; t += 1) {
  try { tickBossDirector(directorSolo, solo, world, t, []); } catch {}
}
if (!isBossAlive(directorSolo)) {
  failures.push('Boss did not spawn with 1 player (solo play should be supported)');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Boss spawns at correct time with proper player checks' }));
} else if (failures.length === 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
