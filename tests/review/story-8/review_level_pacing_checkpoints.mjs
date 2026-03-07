/**
 * Scenario: review_level_pacing_checkpoints (weight: 5)
 * Simulate a player earning XP at a reasonable rate and check level at key timepoints.
 */
import { createShip } from '../../../shared/shipState.js';
import { XP_START, XP_SCALE, XP_ADD } from '../../../shared/constants.js';

const failures = [];

// Simulate XP progression: ~1 NPC kill every 5-10 seconds, each gives ~4 XP
// That's roughly 0.5 XP/s average from kills
const xpPerSecond = 0.5;

// Build the XP curve using actual constants
function simulateLevel(totalSeconds) {
  let level = 1;
  let xp = 0;
  let xpToNext = XP_START;

  const totalXp = totalSeconds * xpPerSecond;
  xp = totalXp;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.floor(xpToNext * XP_SCALE + XP_ADD);
  }
  return level;
}

const checkpoints = [
  { t: 120, label: 'End of Calm Waters', minLevel: 3, maxLevel: 6 },
  { t: 300, label: 'End of Contested Seas', minLevel: 8, maxLevel: 16 },
  { t: 480, label: 'End of War Zone', minLevel: 12, maxLevel: 22 },
  { t: 600, label: 'End of Round', minLevel: 14, maxLevel: 25 }
];

let prevLevel = 0;
for (const cp of checkpoints) {
  const level = simulateLevel(cp.t);
  if (level < cp.minLevel || level > cp.maxLevel) {
    failures.push(`At t=${cp.t} (${cp.label}): level ${level} outside range [${cp.minLevel}, ${cp.maxLevel}]`);
  }
  if (level < prevLevel) {
    failures.push(`Level decreased from ${prevLevel} to ${level} — not monotonic`);
  }
  prevLevel = level;
}

// Edge: 0 XP player stays at level 1
const ship = createShip(0, 0, { id: 1, name: 'AFK' });
if (ship.level !== 1) {
  failures.push(`Ship with no XP starts at level ${ship.level}, expected 1`);
}

// Edge: chain-killer should not hit level 20 before minute 3
// 2 XP/s = very aggressive chain killing
function simulateLevelAggressive(totalSeconds) {
  let level = 1;
  let xp = totalSeconds * 2; // Very aggressive
  let xpToNext = XP_START;
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.floor(xpToNext * XP_SCALE + XP_ADD);
  }
  return level;
}

const aggressiveAt180 = simulateLevelAggressive(180);
if (aggressiveAt180 >= 20) {
  failures.push(`Aggressive player hits level ${aggressiveAt180} by t=180 — too fast`);
}

if (failures.length === 0) {
  const levels = checkpoints.map(cp => `t=${cp.t}:L${simulateLevel(cp.t)}`).join(', ');
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Level pacing: ${levels}` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
