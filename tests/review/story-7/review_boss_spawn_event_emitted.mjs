/**
 * Scenario: review_boss_spawn_event_emitted (weight: 5)
 * When a boss spawns, the server must emit a bossSpawn event with type and position.
 */
import { createBossDirector, tickBossDirector } from '../../../server/bossDirector.js';

const failures = [];

const bd = createBossDirector();
const world = { width: 5000, height: 5000 };
const events = [];

// Tick to t=160 (past the first boss spawn time of ~150)
let roundTime = 0;
const dt = 0.5;
while (roundTime < 160) {
  roundTime += dt;
  tickBossDirector(bd, roundTime, dt, world, events);
}

const spawnEvents = events.filter(e => e.type === 'bossSpawn');

if (spawnEvents.length === 0) {
  failures.push('No bossSpawn event emitted after reaching spawn time');
} else {
  const evt = spawnEvents[0];

  // Must have bossType
  if (!evt.bossType || typeof evt.bossType !== 'string') {
    failures.push(`bossSpawn event missing or invalid bossType: ${evt.bossType}`);
  }

  // Must have x and y coordinates (numbers, not NaN)
  if (typeof evt.x !== 'number' || isNaN(evt.x)) {
    failures.push(`bossSpawn event has invalid x: ${evt.x}`);
  }
  if (typeof evt.y !== 'number' || isNaN(evt.y)) {
    failures.push(`bossSpawn event has invalid y: ${evt.y}`);
  }

  // bossType should be a known archetype
  const knownTypes = ['war_galleon', 'fire_ship', 'kraken'];
  if (evt.bossType && !knownTypes.includes(evt.bossType)) {
    failures.push(`Unknown bossType: '${evt.bossType}'`);
  }
}

// Edge: coordinates at map edge should still be valid
for (const evt of spawnEvents) {
  if (evt.x < 0 || evt.x > world.width || evt.y < 0 || evt.y > world.height) {
    failures.push(`Boss position (${evt.x}, ${evt.y}) outside map bounds`);
  }
}

if (failures.length === 0) {
  const e = spawnEvents[0];
  console.log(JSON.stringify({ verdict: 'PASS', reason: `bossSpawn event emitted: type=${e.bossType}, pos=(${e.x}, ${e.y})` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
