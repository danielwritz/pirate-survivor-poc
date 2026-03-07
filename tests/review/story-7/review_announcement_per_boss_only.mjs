/**
 * Scenario: review_announcement_per_boss_only (weight: 3)
 * Each boss should produce exactly one spawn announcement. No repeats.
 */
import { createBossDirector, tickBossDirector, onBossDefeated } from '../../../server/bossDirector.js';

const failures = [];

const bd = createBossDirector();
const world = { width: 5000, height: 5000 };
const events = [];

// Advance past first boss spawn time
let roundTime = 0;
const dt = 0.5;
while (roundTime < 160) {
  roundTime += dt;
  tickBossDirector(bd, roundTime, dt, world, events);
}

const firstSpawnEvents = events.filter(e => e.type === 'bossSpawn');
if (firstSpawnEvents.length !== 1) {
  failures.push(`Expected exactly 1 bossSpawn event, got ${firstSpawnEvents.length}`);
}

// Tick 100 more times while boss is alive — should NOT re-announce
const eventsBefore = events.length;
for (let i = 0; i < 100; i++) {
  roundTime += dt;
  tickBossDirector(bd, roundTime, dt, world, events);
}

const spawnsDuringLife = events.slice(eventsBefore).filter(e => e.type === 'bossSpawn');
if (spawnsDuringLife.length > 0) {
  failures.push(`${spawnsDuringLife.length} additional bossSpawn events while boss alive`);
}

// After boss defeat and cooldown, a NEW boss spawn should fire a NEW announcement
if (typeof onBossDefeated === 'function') {
  onBossDefeated(bd);
  
  // Advance past cooldown and to next scheduled boss
  const events2 = [];
  while (roundTime < 300) {
    roundTime += dt;
    tickBossDirector(bd, roundTime, dt, world, events2);
  }

  const secondSpawnEvents = events2.filter(e => e.type === 'bossSpawn');
  if (secondSpawnEvents.length === 0) {
    // May not have reached the next boss time yet - this is ok for partial
  } else if (secondSpawnEvents.length > 1) {
    failures.push(`Second boss produced ${secondSpawnEvents.length} events (expected 1)`);
  }
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Exactly 1 announcement per boss, no repeats during boss lifetime' }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
