/**
 * Scenario: review_stage_function_is_pure (weight: 3)
 * Verify getCurrentStage is a pure function in shared/ with no side effects.
 */

const failures = [];

// 1. Must be importable from shared/ (not server/)
let getCurrentStage;
try {
  const mod = await import('../../../shared/stages.js');
  getCurrentStage = mod.getCurrentStage;
  if (typeof getCurrentStage !== 'function') {
    throw new Error('getCurrentStage is not a function');
  }
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `Cannot import getCurrentStage from shared/stages.js: ${e.message}` }));
  process.exit(0);
}

// 2. Pure: same input → same output (call twice, compare)
const times = [0, 60, 119, 120, 300, 480, 600];
for (const t of times) {
  const a = getCurrentStage(t);
  const b = getCurrentStage(t);
  if (a !== b) {
    failures.push(`Not pure: getCurrentStage(${t}) returned ${a} then ${b}`);
  }
}

// 3. No server bootstrap needed — if we got here, it already works
// 4. Returns a string for every input
for (const t of times) {
  const result = getCurrentStage(t);
  if (typeof result !== 'string') {
    failures.push(`getCurrentStage(${t}) returned ${typeof result}, expected string`);
  }
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Pure function in shared/, no side effects' }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
