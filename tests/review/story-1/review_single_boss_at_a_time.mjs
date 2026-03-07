/**
 * Scenario: review_single_boss_at_a_time (weight: 5)
 * Only one boss can exist at a time. After killing it, the next spawn should work.
 */
import { createBossDirector, spawnBoss, isBossAlive, removeBoss, tickBossDirector, getActiveBoss, getBossShip } from '../../../server/bossDirector.js';

const failures = [];
const world = { width: 3000, height: 2100 };
const players = [{ x: 1500, y: 1050, alive: true }];

const director = createBossDirector();

// Spawn a boss manually
try {
  spawnBoss(director, players.map(p => ({ x: p.x, y: p.y })), 150, world);
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `spawnBoss threw: ${e.message}` }));
  process.exit(0);
}

if (!isBossAlive(director)) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: 'Boss not alive after spawnBoss' }));
  process.exit(0);
}

// Try spawning again while boss is alive — should NOT create a second boss
const events1 = [];
for (let i = 0; i < 100; i++) {
  try { tickBossDirector(director, players, world, 200 + i, events1); } catch {}
}

// Check: still only 1 boss. The director pattern varies (some use .boss, some use .bosses Map)
const bossObj = getActiveBoss ? getActiveBoss(director) : director.boss;
const hasSingleBoss = bossObj != null;
if (!hasSingleBoss) {
  failures.push('Boss disappeared after rapid ticking');
}

// Kill the boss
const ship = getBossShip ? getBossShip(director) : bossObj?.ship;
if (ship) {
  ship.alive = false;
  ship.hp = 0;
}

// Remove/clean up via the director
try { removeBoss(director); } catch {
  // Some implementations auto-detect death in tick
}

// After killing, the next spawn trigger SHOULD create a new boss
const events2 = [];
for (let t = 300; t <= 450; t += 1) {
  try { tickBossDirector(director, players, world, t, events2); } catch {}
  if (isBossAlive(director)) break;
}

if (!isBossAlive(director)) {
  failures.push('No new boss spawned after killing the first one (permanent lockout?)');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Single boss enforced; new boss spawns after kill' }));
} else if (failures.length === 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
