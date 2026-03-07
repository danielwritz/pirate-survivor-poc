/**
 * Scenario: review_constants_not_hardcoded (weight: 3)
 * Boss tuning values (spawn timing, HP formula coefficients) must come from
 * shared/constants.js, not be hardcoded in bossDirector.js.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');
const directorSrc = readFileSync(join(root, 'server/bossDirector.js'), 'utf8');
const constantsSrc = readFileSync(join(root, 'shared/constants.js'), 'utf8');

const failures = [];

// Boss-related constant names we expect to find in shared/constants.js
const expectedConstants = [
  'BOSS_HP_BASE', 'BOSS_HP_PER_TIER', 'BOSS_HP_PER_PLAYER',
  'BOSS_FIRST_SPAWN_TIME', 'BOSS_SPAWN_INTERVAL'
];

const missingFromConstants = expectedConstants.filter(c => !constantsSrc.includes(c));
if (missingFromConstants.length > 0) {
  failures.push(`Missing from shared/constants.js: ${missingFromConstants.join(', ')}`);
}

// bossDirector.js should import from shared/constants
if (!directorSrc.includes('constants')) {
  failures.push('bossDirector.js does not import from constants');
}

// Check for suspicious hardcoded numbers in the HP calculation area
// Look for numeric literals that look like tuning values (>= 20) outside of comments
const lines = directorSrc.split('\n');
let suspiciousMagicNumbers = 0;
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import')) continue;
  // Look for bare numbers that could be tuning values in computation expressions
  const matches = trimmed.match(/[=+*]\s*(\d{2,4})\b/g);
  if (matches) {
    for (const m of matches) {
      const num = parseInt(m.replace(/[=+*\s]/g, ''));
      // Common non-tuning numbers: 0, 1, 2, 100 (for percentage), small indices
      if (num >= 20 && num !== 100) suspiciousMagicNumbers++;
    }
  }
}

if (suspiciousMagicNumbers > 3) {
  failures.push(`Found ${suspiciousMagicNumbers} suspicious magic numbers in bossDirector.js — values may be hardcoded`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Boss constants properly defined in shared/constants.js and imported by bossDirector.js' }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
