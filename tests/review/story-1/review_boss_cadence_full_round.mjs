/**
 * Scenario: review_boss_cadence_full_round (weight: 4)
 * Over a 10-minute round, the boss system should produce 3-4 boss encounters.
 */
import { createBossDirector, tickBossDirector, isBossAlive, getBossShip, removeBoss } from '../../../server/bossDirector.js';

const failures = [];
const world = { width: 3000, height: 2100 };
const players = [
  { x: 500, y: 500, alive: true },
  { x: 2500, y: 500, alive: true },
  { x: 500, y: 1600, alive: true },
  { x: 2500, y: 1600, alive: true }
];

const director = createBossDirector();
let bossCount = 0;
let firstBossTime = null;
let bossSpawnTime = null;

for (let t = 0; t <= 600; t += 1) {
  const events = [];
  try { tickBossDirector(director, players, world, t, events); } catch {}

  if (isBossAlive(director)) {
    if (bossSpawnTime === null) {
      bossSpawnTime = t;
      bossCount++;
      if (firstBossTime === null) firstBossTime = t;
    }

    // Kill boss after it's been alive for 60 seconds
    if (t - bossSpawnTime >= 60) {
      const ship = getBossShip ? getBossShip(director) : director.boss?.ship;
      if (ship) { ship.alive = false; ship.hp = 0; }
      try { removeBoss(director); } catch {}
      // Some implementations auto-detect death on next tick
    }
  } else {
    bossSpawnTime = null;
  }
}

// Total bosses: 3-5
if (bossCount < 3) {
  failures.push(`Only ${bossCount} bosses spawned (expected >= 3)`);
}
if (bossCount > 5) {
  failures.push(`${bossCount} bosses spawned (expected <= 5)`);
}

// First boss between t=120 and t=180
if (firstBossTime !== null && (firstBossTime < 120 || firstBossTime > 180)) {
  failures.push(`First boss at t=${firstBossTime} (expected 120-180)`);
}
if (firstBossTime === null) {
  failures.push('No boss ever spawned');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `${bossCount} bosses spawned, first at t=${firstBossTime}` }));
} else if (failures.length === 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
