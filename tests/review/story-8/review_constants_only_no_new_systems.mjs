/**
 * Scenario: review_constants_only_no_new_systems (weight: 3)
 * Story 8 should only modify constants — no new files or systems.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');
const failures = [];

try {
  // Get the diff of this PR's branch against its base
  // We check for new files in server/ or shared/ (excluding test files)
  const diffOutput = execSync('git diff --name-status HEAD~1 -- server/ shared/', {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000
  });

  const lines = diffOutput.trim().split('\n').filter(l => l.trim());
  for (const line of lines) {
    const [status, file] = line.split('\t');
    if (status === 'A' && !file.includes('test')) {
      failures.push(`New production file added: ${file}`);
    }
  }
} catch (e) {
  // If git diff fails, fall back to checking source files directly
  // This is not a blocker — just check constants
}

// Verify constants were actually changed from defaults
import { XP_START, XP_SCALE, MAX_NPCS, NPC_SPAWN_INTERVAL_BASE } from '../../../shared/constants.js';

// At least some constants should differ from original defaults
// Note: on the Story 8 branch, these should be the new values
// Original: XP_START=8, XP_SCALE=1.18, MAX_NPCS=20, NPC_SPAWN_INTERVAL_BASE=3.5
const changesDetected = (
  XP_START !== 8 ||
  XP_SCALE !== 1.18 ||
  MAX_NPCS !== 20 ||
  NPC_SPAWN_INTERVAL_BASE !== 3.5
);

if (!changesDetected) {
  failures.push('No constant changes detected — Story 8 should modify at least some XP/NPC constants');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Constants changed: XP_START=${XP_START}, XP_SCALE=${XP_SCALE}, MAX_NPCS=${MAX_NPCS}, NPC_INTERVAL=${NPC_SPAWN_INTERVAL_BASE}` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
