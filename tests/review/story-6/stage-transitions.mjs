/**
 * Scenario: stage_transition_calm_to_contested (weight 3)
 *           stage_transition_contested_to_warzone (weight 3)
 *           stage_transition_warzone_to_kraken (weight 3)
 *
 * Tests that stage boundaries fire at the correct times and that
 * the simulation emits stageTransition events when crossing boundaries.
 */

import { getCurrentStage, STAGE_CALM_WATERS, STAGE_CONTESTED_SEAS, STAGE_WAR_ZONE, STAGE_KRAKEN_FRONTIER } from '../../../shared/stages.js';
import { createSimulation, tick } from '../../../server/simulation.js';

const ROUND_DURATION = 10 * 60; // 600 seconds
const TICK_INTERVAL = 1 / 20;   // 0.05 seconds

// ── Helper: manually set simulation round time and tick once to capture events ──
function setRoundTimeAndTick(sim, targetRoundTime) {
  // roundTime = ROUND_DURATION - roundTimer  =>  roundTimer = ROUND_DURATION - targetRoundTime
  sim.roundTimer = ROUND_DURATION - targetRoundTime;
  // tick will decrement roundTimer by dt, advancing roundTime by dt
  sim.events = [];
  tick(sim);
  return sim.events;
}

const checks = [];

// ─── Part 1: Pure boundary checks via getCurrentStage ────────────────────────
// Calm → Contested transition: 120s is the boundary
checks.push({ check: 'getCurrentStage(119) === calm_waters',   passed: getCurrentStage(119) === STAGE_CALM_WATERS });
checks.push({ check: 'getCurrentStage(120) === contested_seas', passed: getCurrentStage(120) === STAGE_CONTESTED_SEAS });
checks.push({ check: 'getCurrentStage(121) === contested_seas', passed: getCurrentStage(121) === STAGE_CONTESTED_SEAS });

// Contested → War Zone transition: 300s
checks.push({ check: 'getCurrentStage(299) === contested_seas', passed: getCurrentStage(299) === STAGE_CONTESTED_SEAS });
checks.push({ check: 'getCurrentStage(300) === war_zone',       passed: getCurrentStage(300) === STAGE_WAR_ZONE });

// War Zone → Kraken Frontier transition: 480s
checks.push({ check: 'getCurrentStage(479) === war_zone',         passed: getCurrentStage(479) === STAGE_WAR_ZONE });
checks.push({ check: 'getCurrentStage(480) === kraken_frontier',  passed: getCurrentStage(480) === STAGE_KRAKEN_FRONTIER });
checks.push({ check: 'getCurrentStage(600) === kraken_frontier',  passed: getCurrentStage(600) === STAGE_KRAKEN_FRONTIER });

// ─── Part 2: Simulation event emission ──────────────────────────────────────
// Create a simulation and push it to just before each boundary, then tick over it.

let sim;
try {
  sim = await createSimulation();
} catch (e) {
  console.log(JSON.stringify({
    scenario: 'stage_transitions',
    result: 'fail',
    details: `createSimulation threw: ${e.message}`,
    checks
  }));
  process.exit(0);
}

// ── Calm → Contested (tick from 119.95s to 120s) ──
// Manually set the stage as it would be at 119.95s
sim.currentStage = STAGE_CALM_WATERS;
const eventsAtCalm2Contested = setRoundTimeAndTick(sim, 119.95);
const calmToContestedEvt = eventsAtCalm2Contested.find(e => e.type === 'stageTransition' && e.stage === STAGE_CONTESTED_SEAS);
checks.push({ check: 'stageTransition event emitted for calm→contested', passed: !!calmToContestedEvt });
checks.push({ check: 'sim.currentStage updated to contested_seas',        passed: sim.currentStage === STAGE_CONTESTED_SEAS });

// ── Contested → War Zone (tick from 299.95s to 300s) ──
sim.currentStage = STAGE_CONTESTED_SEAS;
const eventsAtContested2WarZone = setRoundTimeAndTick(sim, 299.95);
const contestedToWarZoneEvt = eventsAtContested2WarZone.find(e => e.type === 'stageTransition' && e.stage === STAGE_WAR_ZONE);
checks.push({ check: 'stageTransition event emitted for contested→war_zone', passed: !!contestedToWarZoneEvt });
checks.push({ check: 'sim.currentStage updated to war_zone',                  passed: sim.currentStage === STAGE_WAR_ZONE });

// ── War Zone → Kraken Frontier (tick from 479.95s to 480s) ──
sim.currentStage = STAGE_WAR_ZONE;
const eventsAtWarZone2Kraken = setRoundTimeAndTick(sim, 479.95);
const warZoneToKrakenEvt = eventsAtWarZone2Kraken.find(e => e.type === 'stageTransition' && e.stage === STAGE_KRAKEN_FRONTIER);
checks.push({ check: 'stageTransition event emitted for war_zone→kraken_frontier', passed: !!warZoneToKrakenEvt });
checks.push({ check: 'sim.currentStage updated to kraken_frontier',                 passed: sim.currentStage === STAGE_KRAKEN_FRONTIER });

// ── resetRound resets stage to calm_waters ──
const { resetRound } = await import('../../../server/simulation.js');
resetRound(sim);
checks.push({ check: 'resetRound resets currentStage to calm_waters', passed: sim.currentStage === STAGE_CALM_WATERS });

const allPassed = checks.every(c => c.passed);
const corePassed = checks.slice(0, 8).every(c => c.passed); // boundary checks
const eventsPassed = checks.slice(8).every(c => c.passed);

let result;
if (allPassed) {
  result = 'pass';
} else if (corePassed || eventsPassed) {
  result = 'partial';
} else {
  result = 'fail';
}

const failing = checks.filter(c => !c.passed);
console.log(JSON.stringify({
  scenario: 'stage_transitions',
  result,
  details: allPassed
    ? 'All boundary + event checks passed'
    : `${failing.length} check(s) failed: ${failing.map(c => c.check).join('; ')}`,
  checks
}, null, 2));
