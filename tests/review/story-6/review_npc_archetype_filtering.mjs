/**
 * Scenario: review_npc_archetype_filtering
 * Verifies that the correct archetype pools are returned per stage and
 * that rollNpcArchetype respects the filtered pool.
 */
import { getAllowedArchetypes } from '../../../shared/stages.js';
import { rollNpcArchetype } from '../../../server/npcDirector.js';

const checks = [];

// Helper: verify a pool contains exactly the expected archetypes and no others
function checkPool(label, time, expectedArchetypes, forbiddenArchetypes) {
  const pool = getAllowedArchetypes(time);
  for (const arch of expectedArchetypes) {
    checks.push({ check: `${label}: pool contains '${arch}'`, passed: pool.includes(arch) });
  }
  for (const arch of forbiddenArchetypes) {
    checks.push({ check: `${label}: pool does NOT contain '${arch}'`, passed: !pool.includes(arch) });
  }
  return pool;
}

// Calm Waters (t=0): only basic/weak, no heavy/scavenger
checkPool('Calm Waters t=0',   0,   ['weak', 'standard'], ['heavy', 'scavenger']);
checkPool('Calm Waters t=60',  60,  ['weak', 'standard'], ['heavy', 'scavenger']);
checkPool('Calm Waters t=119', 119, ['weak', 'standard'], ['heavy', 'scavenger']);

// Contested Seas (t=120): basic + heavy, no scavenger
checkPool('Contested Seas t=120', 120, ['weak', 'standard', 'heavy'], ['scavenger']);
checkPool('Contested Seas t=200', 200, ['weak', 'standard', 'heavy'], ['scavenger']);

// War Zone (t=300): basic + heavy + scavenger
checkPool('War Zone t=300', 300, ['weak', 'standard', 'heavy', 'scavenger'], []);
checkPool('War Zone t=400', 400, ['weak', 'standard', 'heavy', 'scavenger'], []);

// Kraken Frontier (t=480): all archetypes
checkPool('Kraken Frontier t=480', 480, ['weak', 'standard', 'heavy', 'scavenger'], []);
checkPool('Kraken Frontier t=550', 550, ['weak', 'standard', 'heavy', 'scavenger'], []);

// No pool should be empty
for (const [label, time] of [['calm', 0], ['contested', 120], ['warzone', 300], ['kraken', 480]]) {
  const pool = getAllowedArchetypes(time);
  checks.push({ check: `${label} pool is non-empty`, passed: Array.isArray(pool) && pool.length > 0 });
}

// rollNpcArchetype with Calm Waters pool never returns heavy or scavenger
const calmPool = getAllowedArchetypes(60);
const TRIALS = 500;
let calmViolation = null;
for (let i = 0; i < TRIALS; i++) {
  const result = rollNpcArchetype(Math.random(), calmPool);
  if (result === 'heavy' || result === 'scavenger') {
    calmViolation = result;
    break;
  }
}
checks.push({
  check: `rollNpcArchetype with calm pool never produces heavy/scavenger (${TRIALS} trials)`,
  passed: calmViolation === null
});

// rollNpcArchetype with contested pool may return heavy but not scavenger
const contestedPool = getAllowedArchetypes(150);
let contestedViolation = null;
for (let i = 0; i < TRIALS; i++) {
  const result = rollNpcArchetype(Math.random(), contestedPool);
  if (result === 'scavenger') {
    contestedViolation = result;
    break;
  }
}
checks.push({
  check: `rollNpcArchetype with contested pool never produces scavenger (${TRIALS} trials)`,
  passed: contestedViolation === null
});

// rollNpcArchetype with no pool (unrestricted) produces all 4 types
const unrestricted = new Set();
for (let i = 0; i < 2000; i++) {
  unrestricted.add(rollNpcArchetype(Math.random()));
}
checks.push({ check: 'unrestricted pool produces weak',     passed: unrestricted.has('weak') });
checks.push({ check: 'unrestricted pool produces standard', passed: unrestricted.has('standard') });
checks.push({ check: 'unrestricted pool produces heavy',    passed: unrestricted.has('heavy') });
checks.push({ check: 'unrestricted pool produces scavenger',passed: unrestricted.has('scavenger') });

const allPassed = checks.every(c => c.passed);
const failedChecks = checks.filter(c => !c.passed);

console.log(JSON.stringify({
  scenario: 'review_npc_archetype_filtering',
  result: allPassed ? 'pass' : failedChecks.length <= 2 ? 'partial' : 'fail',
  details: allPassed
    ? `All ${checks.length} archetype filtering checks passed`
    : `${failedChecks.length} checks failed: ${failedChecks.map(c => c.check).join('; ')}`,
  checks
}, null, 2));
