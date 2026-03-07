/**
 * Scenario: review_stage_transition_events (weight: 4)
 * Verify that advancing time through the four stages produces 3 stageTransition events.
 *
 * tick() computes roundTime as ROUND_DURATION - sim.roundTimer (countdown).
 * ROUND_DURATION = 600. Transitions happen at roundTime 120, 300, 480.
 * We set sim.roundTimer to values that place us just before each boundary,
 * then tick once past the boundary so the stage comparison detects the change.
 */
import { createSimulation, tick, TICK_INTERVAL } from '../../../server/simulation.js';
import { ROUND_DURATION } from '../../../shared/constants.js';

const failures = [];
let sim;
try {
  sim = await createSimulation();
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `createSimulation failed: ${e.message}` }));
  process.exit(0);
}

// Collect all stageTransition events
const transitionEvents = [];

// Boundary roundTimes: 120 (calm→contested), 300 (contested→war), 480 (war→kraken)
// For each boundary, set roundTimer so current tick lands just before, then tick past it.
const boundaries = [
  { before: 119, after: 120.5 },  // calm → contested
  { before: 299, after: 300.5 },  // contested → war
  { before: 479, after: 480.5 }   // war → kraken
];

for (const { before, after } of boundaries) {
  // Position sim just before the boundary
  sim.roundTimer = ROUND_DURATION - before;
  sim.time = before;
  sim.events = [];
  try { tick(sim); } catch { /* allow tick errors from missing players */ }
  // Collect any transition from the "before" tick (shouldn't be one)
  for (const ev of (sim.events || [])) {
    if (ev.type === 'stageTransition') {
      transitionEvents.push({ time: before, stage: ev.stage });
    }
  }

  // Now position sim so roundTime crosses the boundary
  sim.roundTimer = ROUND_DURATION - after;
  sim.time = after;
  sim.events = [];
  try { tick(sim); } catch { /* allow */ }
  for (const ev of (sim.events || [])) {
    if (ev.type === 'stageTransition') {
      transitionEvents.push({ time: after, stage: ev.stage });
    }
  }
}

// We expect exactly 3 transitions
if (transitionEvents.length < 3) {
  failures.push(`Expected >=3 stageTransition events, got ${transitionEvents.length}`);
}

// Check: no duplicates (same stage announced twice consecutively)  
const stages = transitionEvents.map(e => e.stage);
for (let i = 1; i < stages.length; i++) {
  if (stages[i] === stages[i - 1]) {
    failures.push(`Duplicate transition to ${stages[i]} at index ${i}`);
  }
}

// Check: each event has a stage name
for (const ev of transitionEvents) {
  if (!ev.stage) failures.push('Transition event missing stage name');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `${transitionEvents.length} transition events emitted correctly` }));
} else if (failures.length === 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
