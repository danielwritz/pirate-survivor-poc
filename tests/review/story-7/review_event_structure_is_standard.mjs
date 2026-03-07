/**
 * Scenario: review_event_structure_is_standard (weight: 3)
 * The bossSpawn event should follow existing broadcast patterns and be JSON-serializable.
 */
import { createBossDirector, tickBossDirector } from '../../../server/bossDirector.js';

const failures = [];

const bd = createBossDirector();
const world = { width: 5000, height: 5000 };
const events = [];

let roundTime = 0;
const dt = 1;
while (roundTime < 160) {
  roundTime += dt;
  tickBossDirector(bd, roundTime, dt, world, events);
}

const spawnEvents = events.filter(e => e.type === 'bossSpawn');

if (spawnEvents.length === 0) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: 'No bossSpawn event emitted to check structure' }));
  process.exit(0);
}

const evt = spawnEvents[0];

// Should be JSON-serializable (no circular refs, no functions)
try {
  const json = JSON.stringify(evt);
  const parsed = JSON.parse(json);
  if (typeof parsed !== 'object') {
    failures.push('Event does not roundtrip as JSON object');
  }
} catch (e) {
  failures.push(`Event is not JSON-serializable: ${e.message}`);
}

// Should have a 'type' field (standard pattern for events)
if (!evt.type) {
  failures.push('Event missing type field');
}

// Should not leak full boss state (no hp, maxHp, _input, etc.)
const leakyFields = ['hp', 'maxHp', '_input', 'aiState', 'weaponLayout', 'cannonMountTimers'];
const leaked = leakyFields.filter(f => evt[f] !== undefined);
if (leaked.length > 0) {
  failures.push(`Event leaks internal state: ${leaked.join(', ')}`);
}

// Event fields should be reasonable: type, bossType, x, y — and possibly display name
const expectedFields = ['type', 'bossType', 'x', 'y'];
const missingFields = expectedFields.filter(f => evt[f] === undefined);
if (missingFields.length > 0) {
  failures.push(`Event missing standard fields: ${missingFields.join(', ')}`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Event follows standard structure: ${JSON.stringify(evt)}` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
