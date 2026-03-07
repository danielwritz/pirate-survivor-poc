/**
 * Scenario: review_announcement_has_position (weight: 4)
 * The boss position in the event must be accurate so clients can render indicators.
 */
import { createBossDirector, tickBossDirector } from '../../../server/bossDirector.js';

const failures = [];

const bd = createBossDirector();
const world = { width: 5000, height: 5000 };
const events = [];

// Advance to trigger first boss spawn
let roundTime = 0;
const dt = 1;
while (roundTime < 160) {
  roundTime += dt;
  tickBossDirector(bd, roundTime, dt, world, events);
}

const spawnEvents = events.filter(e => e.type === 'bossSpawn');

if (spawnEvents.length === 0) {
  failures.push('No bossSpawn event to check position');
} else {
  const evt = spawnEvents[0];

  // Position must be numeric
  if (typeof evt.x !== 'number') {
    failures.push(`x is not a number: ${typeof evt.x}`);
  }
  if (typeof evt.y !== 'number') {
    failures.push(`y is not a number: ${typeof evt.y}`);
  }

  // Position should not be (0, 0) or dead center by default (that would be suspicious)
  // It should be a meaningful position on the map
  if (evt.x === 0 && evt.y === 0) {
    failures.push('Boss position is (0, 0) — likely uninitialized');
  }

  // Should be within map bounds
  if (evt.x < 0 || evt.x > world.width) {
    failures.push(`x (${evt.x}) outside map bounds [0, ${world.width}]`);
  }
  if (evt.y < 0 || evt.y > world.height) {
    failures.push(`y (${evt.y}) outside map bounds [0, ${world.height}]`);
  }
}

if (failures.length === 0) {
  const e = spawnEvents[0];
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Boss position is accurate: (${e.x}, ${e.y})` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
