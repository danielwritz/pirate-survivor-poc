/**
 * Scenario: review_kraken_broadcasts_area_event (weight: 3)
 * Kraken must emit areaDenial events so clients can render visual indicators.
 */
import { createKrakenBoss, tickKrakenBoss } from '../../../server/bossDirector.js';

const failures = [];

const boss = createKrakenBoss(1000, 1000, 4);
const events = [];

// Tick enough times to trigger at least one pulse (pulse interval ~1.5s)
for (let i = 0; i < 60; i++) {
  tickKrakenBoss(boss, [], 0.05, events);
}

const areaEvents = events.filter(e => e.type === 'areaDenial');

if (areaEvents.length === 0) {
  failures.push('No areaDenial event emitted after multiple ticks');
} else {
  const evt = areaEvents[0];
  if (evt.x === undefined || evt.y === undefined) {
    failures.push('areaDenial event missing position (x, y)');
  }
  if (evt.x !== boss.x || evt.y !== boss.y) {
    failures.push(`Event position (${evt.x}, ${evt.y}) does not match boss position (${boss.x}, ${boss.y})`);
  }
  if (evt.radius === undefined) {
    failures.push('areaDenial event missing radius');
  }
}

// Edge: event should be emitted on first pulse, not delayed excessively
// First pulse should happen within ~2 seconds (40 ticks at 0.05s)
const events2 = [];
const boss2 = createKrakenBoss(500, 500, 2);
for (let i = 0; i < 40; i++) {
  tickKrakenBoss(boss2, [], 0.05, events2);
}
if (events2.filter(e => e.type === 'areaDenial').length === 0) {
  failures.push('No areaDenial event in first 2 seconds — too delayed');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `areaDenial event emitted with position and radius (${areaEvents.length} events in 3s)` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
