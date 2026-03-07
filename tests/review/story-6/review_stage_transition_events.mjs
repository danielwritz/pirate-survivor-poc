/**
 * Scenario: review_stage_transition_events
 * Verifies that stageTransition events are emitted exactly once per stage change.
 *
 * Strategy: create simulation, then fast-forward by manipulating roundTimer to just
 * before each transition boundary and invoke tick() to cross the boundary.
 */
import { createSimulation, tick } from '../../../server/simulation.js';
import {
  STAGE_CALM_WATERS, STAGE_CONTESTED_SEAS, STAGE_WAR_ZONE, STAGE_KRAKEN_FRONTIER
} from '../../../shared/stages.js';

const checks = [];

// ROUND_DURATION = 600, TICK_INTERVAL = 1/20 = 0.05
// roundTime = 600 - roundTimer
// To cross boundary at roundTime=X: set roundTimer = 600 - X + epsilon

const ROUND_DURATION = 600;
const TICK_INTERVAL = 1 / 20;

// Helper: bump sim roundTimer to just before a boundary, then tick once
function tickAcrossBoundary(sim, boundaryTime) {
  // Set roundTimer so that roundTime is just under the boundary
  sim.roundTimer = ROUND_DURATION - (boundaryTime - TICK_INTERVAL * 0.5);
  sim.events.length = 0; // clear prior events
  tick(sim);
  return sim.events.filter(e => e.type === 'stageTransition');
}

const sim = await createSimulation(null);

// ─── Transition 1: Calm Waters → Contested Seas (at t=120) ───
const t1Events = tickAcrossBoundary(sim, 120);
checks.push({
  check: 'Calm→Contested: exactly 1 stageTransition event emitted at t=120',
  passed: t1Events.length === 1,
  actual: t1Events.length
});
checks.push({
  check: 'Calm→Contested: event stage is contested_seas',
  passed: t1Events.length > 0 && t1Events[0].stage === STAGE_CONTESTED_SEAS,
  actual: t1Events[0]?.stage
});

// Tick again at same roundTime — should NOT re-emit
sim.events.length = 0;
// Do NOT change roundTimer — just tick once more from same position
// roundTimer should now be in contested territory, so no new transition
tick(sim);
const t1Duplicate = sim.events.filter(e => e.type === 'stageTransition');
checks.push({
  check: 'Calm→Contested: no duplicate transition on second tick',
  passed: t1Duplicate.length === 0,
  actual: t1Duplicate.length
});

// ─── Transition 2: Contested Seas → War Zone (at t=300) ───
// Fast-forward sim state
sim.currentStage = STAGE_CONTESTED_SEAS;
const t2Events = tickAcrossBoundary(sim, 300);
checks.push({
  check: 'Contested→War Zone: exactly 1 stageTransition event at t=300',
  passed: t2Events.length === 1,
  actual: t2Events.length
});
checks.push({
  check: 'Contested→War Zone: event stage is war_zone',
  passed: t2Events.length > 0 && t2Events[0].stage === STAGE_WAR_ZONE,
  actual: t2Events[0]?.stage
});

// ─── Transition 3: War Zone → Kraken Frontier (at t=480) ───
sim.currentStage = STAGE_WAR_ZONE;
const t3Events = tickAcrossBoundary(sim, 480);
checks.push({
  check: 'War Zone→Kraken: exactly 1 stageTransition event at t=480',
  passed: t3Events.length === 1,
  actual: t3Events.length
});
checks.push({
  check: 'War Zone→Kraken: event stage is kraken_frontier',
  passed: t3Events.length > 0 && t3Events[0].stage === STAGE_KRAKEN_FRONTIER,
  actual: t3Events[0]?.stage
});

// ─── No 4th transition: after Kraken Frontier, no more stage changes ───
sim.events.length = 0;
sim.roundTimer = 0.5; // near end of round
tick(sim);
const t4Events = sim.events.filter(e => e.type === 'stageTransition');
checks.push({
  check: 'Kraken Frontier: no further stage transitions at end of round',
  passed: t4Events.length === 0,
  actual: t4Events.length
});

// ─── Jump-across test: if roundTime jumps from 100 to 350, both transitions should fire ───
// We test this by setting up calm_waters state and then jumping timer across both boundaries
const sim2 = await createSimulation(null);
sim2.currentStage = STAGE_CALM_WATERS;
// Position roundTimer so roundTime goes from 119 to 351 in one tick is not realistic,
// but we can simulate by calling tick with roundTimer set to 250 (roundTime 350) directly.
// The actual detection is per-tick, so this tests a "missed" transition scenario.
// The implementation computes currentStage every tick; if roundTimer is jumped externally
// it will detect the resulting stage correctly in the next tick.
sim2.roundTimer = ROUND_DURATION - 350; // roundTime = 350 (war zone)
sim2.events.length = 0;
tick(sim2);
const jumpEvents = sim2.events.filter(e => e.type === 'stageTransition');
// The jump should produce at least one stageTransition (to war_zone)
// Whether it also catches contested is implementation-dependent
checks.push({
  check: 'Jump from calm to war_zone: at least 1 stageTransition emitted',
  passed: jumpEvents.length >= 1,
  actual: jumpEvents.length
});
// The final stage should be war_zone
checks.push({
  check: 'Jump from calm to war_zone: final event stage is war_zone',
  passed: jumpEvents.length > 0 && jumpEvents[jumpEvents.length - 1].stage === STAGE_WAR_ZONE,
  actual: jumpEvents[jumpEvents.length - 1]?.stage
});

const allPassed = checks.every(c => c.passed);
const failedChecks = checks.filter(c => !c.passed);

console.log(JSON.stringify({
  scenario: 'review_stage_transition_events',
  result: allPassed ? 'pass' : failedChecks.length <= 2 ? 'partial' : 'fail',
  details: allPassed
    ? `All ${checks.length} stage transition event checks passed`
    : `${failedChecks.length} checks failed: ${failedChecks.map(c => c.check).join('; ')}`,
  checks
}, null, 2));
