/**
 * Scenario: calm_waters_weak_npcs_only (weight 2)
 *
 * During Calm Waters (0–119s), only 'weak' and 'standard' NPC archetypes
 * are eligible to spawn. Heavy and scavenger NPCs must NOT appear.
 *
 * Also verifies that the full pool opens in later stages.
 */

import { getAllowedArchetypes, STAGE_CALM_WATERS, STAGE_CONTESTED_SEAS, STAGE_WAR_ZONE, STAGE_KRAKEN_FRONTIER } from '../../../shared/stages.js';
import { rollNpcArchetype } from '../../../server/npcDirector.js';

const checks = [];

// ─── 1. getAllowedArchetypes returns correct pools per stage ──────────────────

const calmPool        = getAllowedArchetypes(0);
const contestedPool   = getAllowedArchetypes(150);
const warZonePool     = getAllowedArchetypes(350);
const krakenPool      = getAllowedArchetypes(500);

// Calm Waters: only weak + standard
checks.push({ check: 'calm pool contains weak',          passed: calmPool.includes('weak') });
checks.push({ check: 'calm pool contains standard',      passed: calmPool.includes('standard') });
checks.push({ check: 'calm pool excludes heavy',         passed: !calmPool.includes('heavy') });
checks.push({ check: 'calm pool excludes scavenger',     passed: !calmPool.includes('scavenger') });

// Contested Seas: adds heavy
checks.push({ check: 'contested pool contains heavy',    passed: contestedPool.includes('heavy') });
checks.push({ check: 'contested pool excludes scavenger', passed: !contestedPool.includes('scavenger') });

// War Zone: adds scavenger
checks.push({ check: 'warzone pool contains scavenger',  passed: warZonePool.includes('scavenger') });

// Kraken Frontier: full pool
checks.push({ check: 'kraken pool has all 4 archetypes', passed: ['weak','standard','heavy','scavenger'].every(a => krakenPool.includes(a)) });

// ─── 2. rollNpcArchetype with calm pool NEVER returns heavy or scavenger ─────
const SAMPLES = 500;
const forbiddenInCalm = new Set();
for (let i = 0; i < SAMPLES; i++) {
  const arch = rollNpcArchetype(Math.random(), calmPool);
  if (arch === 'heavy' || arch === 'scavenger') forbiddenInCalm.add(arch);
}
checks.push({ check: `rollNpcArchetype with calm pool never returns heavy/scavenger over ${SAMPLES} samples`, passed: forbiddenInCalm.size === 0 });

// ─── 3. rollNpcArchetype with calm pool DOES return both weak and standard ───
const seenInCalm = new Set();
for (let i = 0; i < SAMPLES; i++) {
  seenInCalm.add(rollNpcArchetype(Math.random(), calmPool));
}
checks.push({ check: 'calm pool roll produces weak',    passed: seenInCalm.has('weak') });
checks.push({ check: 'calm pool roll produces standard', passed: seenInCalm.has('standard') });

// ─── 4. rollNpcArchetype with war-zone pool eventually produces all 4 ────────
const seenInWarZone = new Set();
for (let i = 0; i < SAMPLES; i++) {
  seenInWarZone.add(rollNpcArchetype(Math.random(), warZonePool));
}
checks.push({ check: 'war zone pool roll can produce scavenger', passed: seenInWarZone.has('scavenger') });

// ─── 5. Deterministic boundary check: roll=0.999 in calm pool should NOT yield scavenger ──
// The calm pool [weak, standard] — after re-normalizing weights (0.30+0.35=0.65),
// the last bucket should be standard, not scavenger.
const deterministicResult = rollNpcArchetype(0.9999, calmPool);
checks.push({ check: `deterministic roll(0.9999) in calm pool returns standard, got '${deterministicResult}'`, passed: deterministicResult === 'standard' });

const allPassed = checks.every(c => c.passed);
const failedChecks = checks.filter(c => !c.passed);

console.log(JSON.stringify({
  scenario: 'calm_waters_weak_npcs_only',
  result: allPassed ? 'pass' : (checks.slice(0, 8).every(c => c.passed) ? 'partial' : 'fail'),
  details: allPassed
    ? 'All archetype pool and roll checks passed'
    : `${failedChecks.length} check(s) failed: ${failedChecks.map(c => c.check).join('; ')}`,
  checks
}, null, 2));
