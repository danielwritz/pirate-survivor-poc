/**
 * Scenario: review_stage_boundaries_correct (weight: 5)
 * Verify getCurrentStage returns the correct stage at every boundary.
 */
import { getCurrentStage, STAGE_CALM_WATERS, STAGE_CONTESTED_SEAS,
  STAGE_WAR_ZONE, STAGE_KRAKEN_FRONTIER } from '../../../shared/stages.js';

const expected = [
  [0,     STAGE_CALM_WATERS],
  [60,    STAGE_CALM_WATERS],
  [119,   STAGE_CALM_WATERS],
  [119.9, STAGE_CALM_WATERS],
  [120,   STAGE_CONTESTED_SEAS],
  [200,   STAGE_CONTESTED_SEAS],
  [299,   STAGE_CONTESTED_SEAS],
  [300,   STAGE_WAR_ZONE],
  [400,   STAGE_WAR_ZONE],
  [479,   STAGE_WAR_ZONE],
  [480,   STAGE_KRAKEN_FRONTIER],
  [550,   STAGE_KRAKEN_FRONTIER],
  [600,   STAGE_KRAKEN_FRONTIER],
  [601,   STAGE_KRAKEN_FRONTIER],  // edge: past round end
];

const failures = [];
for (const [t, want] of expected) {
  const got = getCurrentStage(t);
  if (got !== want) failures.push(`t=${t}: expected ${want}, got ${got}`);
}

// Edge: negative time should not crash
let negativeOk = true;
try { getCurrentStage(-1); } catch { negativeOk = false; }

if (!negativeOk) failures.push('t=-1 caused an exception');

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'All 14 boundary checks passed' }));
} else if (failures.length <= 2) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
