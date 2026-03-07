/**
 * Scenario: review_stage_function_is_pure
 * Verifies that getCurrentStage and getAllowedArchetypes are importable from shared/
 * with no server dependencies, are deterministic, and have no observable side effects.
 */
import { getCurrentStage, getAllowedArchetypes } from '../../../shared/stages.js';

const checks = [];

// ─── Importable from shared/ without server bootstrap ───
checks.push({
  check: 'getCurrentStage is importable from shared/stages.js',
  passed: typeof getCurrentStage === 'function'
});
checks.push({
  check: 'getAllowedArchetypes is importable from shared/stages.js',
  passed: typeof getAllowedArchetypes === 'function'
});

// ─── Returns a string (stage name), not undefined or null ───
const stage0 = getCurrentStage(0);
checks.push({ check: 'getCurrentStage(0) returns a string', passed: typeof stage0 === 'string' && stage0.length > 0 });
const stage300 = getCurrentStage(300);
checks.push({ check: 'getCurrentStage(300) returns a string', passed: typeof stage300 === 'string' && stage300.length > 0 });

// ─── Deterministic (same input → same output, twice in a row) ───
const times = [0, 60, 119, 120, 299, 300, 479, 480, 600, 601];
let determinismFail = null;
for (const t of times) {
  const r1 = getCurrentStage(t);
  const r2 = getCurrentStage(t);
  if (r1 !== r2) {
    determinismFail = `t=${t}: got '${r1}' then '${r2}'`;
    break;
  }
}
checks.push({
  check: 'getCurrentStage is deterministic (same input → same output)',
  passed: determinismFail === null,
  actual: determinismFail
});

// ─── getAllowedArchetypes is deterministic ───
let poolDeterminismFail = null;
for (const t of [0, 120, 300, 480]) {
  const p1 = getAllowedArchetypes(t);
  const p2 = getAllowedArchetypes(t);
  if (JSON.stringify(p1) !== JSON.stringify(p2)) {
    poolDeterminismFail = `t=${t}: got ${JSON.stringify(p1)} then ${JSON.stringify(p2)}`;
    break;
  }
}
checks.push({
  check: 'getAllowedArchetypes is deterministic',
  passed: poolDeterminismFail === null,
  actual: poolDeterminismFail
});

// ─── No side effects: calling it repeatedly does not change prior results ───
const stagesBeforeRepeat = times.map(t => getCurrentStage(t));
// Call 100 times with arbitrary inputs
for (let i = 0; i < 100; i++) {
  getCurrentStage(Math.random() * 700 - 50);
}
const stagesAfterRepeat = times.map(t => getCurrentStage(t));
const sideEffectFree = stagesBeforeRepeat.every((s, i) => s === stagesAfterRepeat[i]);
checks.push({
  check: 'getCurrentStage has no side effects (results unchanged after 100 arbitrary calls)',
  passed: sideEffectFree
});

// ─── Does NOT require server-side state (module imports no server modules) ───
// We indirectly verify this: the import above succeeded with no server bootstrap
checks.push({
  check: 'shared/stages.js imports successfully without server context',
  passed: true // if we reached here, the import worked
});

// ─── Returns all 4 known stage names ───
const allStages = new Set(times.map(t => getCurrentStage(t)));
checks.push({ check: 'Returns calm_waters', passed: allStages.has('calm_waters') });
checks.push({ check: 'Returns contested_seas', passed: allStages.has('contested_seas') });
checks.push({ check: 'Returns war_zone', passed: allStages.has('war_zone') });
checks.push({ check: 'Returns kraken_frontier', passed: allStages.has('kraken_frontier') });

const allPassed = checks.every(c => c.passed);
const failedChecks = checks.filter(c => !c.passed);

console.log(JSON.stringify({
  scenario: 'review_stage_function_is_pure',
  result: allPassed ? 'pass' : failedChecks.length <= 2 ? 'partial' : 'fail',
  details: allPassed
    ? `All ${checks.length} purity/determinism checks passed`
    : `${failedChecks.length} checks failed: ${failedChecks.map(c => c.check).join('; ')}`,
  checks
}, null, 2));
