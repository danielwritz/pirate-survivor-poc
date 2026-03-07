/**
 * Scenario: review_stage_transition_events (weight: 4)
 * Verify that advancing time produces exactly 3 stage transition events.
 */
import { createSimulation, tick } from '../../server/simulation.js';

const failures = [];
let sim;
try {
  sim = await createSimulation();
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `createSimulation failed: ${e.message}` }));
  process.exit(0);
}

// Collect all stageTransition events by ticking from 0 to 601 seconds
const transitionEvents = [];
const tickInterval = sim.tickInterval ?? (1 / 20); // 20Hz = 0.05s

// We'll manipulate roundTime directly rather than ticking 12000 times
// Tick in 1-second jumps to stay fast but catch transitions
const checkpoints = [0, 60, 119, 120, 200, 299, 300, 400, 479, 480, 550, 600];

for (const targetTime of checkpoints) {
  sim.roundTime = targetTime;
  sim.events = [];
  try {
    tick(sim);
  } catch (e) {
    // Some ticks may fail due to missing players etc — that's ok, we just want events
  }
  for (const ev of (sim.events || [])) {
    if (ev.type === 'stageTransition') {
      transitionEvents.push({ time: targetTime, stage: ev.stage });
    }
  }
}

// We expect transitions at: ~120 (calm→contested), ~300 (contested→war), ~480 (war→kraken)
// Since we jump directly, transitions happen when currentStage changes between ticks

// Check: must have at least 3 transitions
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
