/**
 * Scenario: review_stage_boundaries_correct
 * Verifies exact stage boundaries at all key time points including edge cases.
 */
import { getCurrentStage } from '../../../shared/stages.js';
import {
  STAGE_CALM_WATERS, STAGE_CONTESTED_SEAS, STAGE_WAR_ZONE, STAGE_KRAKEN_FRONTIER
} from '../../../shared/stages.js';

const checks = [];

function check(label, actual, expected) {
  const passed = actual === expected;
  checks.push({ check: label, passed, actual, expected });
}

// Core boundary verification from rubric
check('t=0 → calm_waters',        getCurrentStage(0),    STAGE_CALM_WATERS);
check('t=60 → calm_waters',       getCurrentStage(60),   STAGE_CALM_WATERS);
check('t=119 → calm_waters',      getCurrentStage(119),  STAGE_CALM_WATERS);
check('t=120 → contested_seas',   getCurrentStage(120),  STAGE_CONTESTED_SEAS);
check('t=200 → contested_seas',   getCurrentStage(200),  STAGE_CONTESTED_SEAS);
check('t=299 → contested_seas',   getCurrentStage(299),  STAGE_CONTESTED_SEAS);
check('t=300 → war_zone',         getCurrentStage(300),  STAGE_WAR_ZONE);
check('t=400 → war_zone',         getCurrentStage(400),  STAGE_WAR_ZONE);
check('t=479 → war_zone',         getCurrentStage(479),  STAGE_WAR_ZONE);
check('t=480 → kraken_frontier',  getCurrentStage(480),  STAGE_KRAKEN_FRONTIER);
check('t=550 → kraken_frontier',  getCurrentStage(550),  STAGE_KRAKEN_FRONTIER);
check('t=600 → kraken_frontier',  getCurrentStage(600),  STAGE_KRAKEN_FRONTIER);

// Edge cases from rubric
const negResult = getCurrentStage(-1);
checks.push({
  check: 't=-1 → calm_waters or does not throw',
  passed: negResult === STAGE_CALM_WATERS || typeof negResult === 'string',
  actual: negResult
});

check('t=601 → kraken_frontier (not undefined)', getCurrentStage(601), STAGE_KRAKEN_FRONTIER);

// Float boundary: 119.9 should still be calm_waters
check('t=119.9 → calm_waters', getCurrentStage(119.9), STAGE_CALM_WATERS);

const allPassed = checks.every(c => c.passed);
const failedChecks = checks.filter(c => !c.passed);

console.log(JSON.stringify({
  scenario: 'review_stage_boundaries_correct',
  result: allPassed ? 'pass' : failedChecks.length <= 2 ? 'partial' : 'fail',
  details: allPassed
    ? `All ${checks.length} boundary checks passed`
    : `${failedChecks.length} checks failed: ${failedChecks.map(c => c.check).join('; ')}`,
  checks
}, null, 2));
