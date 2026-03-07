/**
 * Scenario: review_director_pattern_compliance (weight: 3)
 * The boss director must follow the established director pattern:
 * createBossDirector(), tickBossDirector(), and a single-instance enforcement.
 */
import * as bd from '../../../server/bossDirector.js';

const failures = [];

// Must export createBossDirector
if (typeof bd.createBossDirector !== 'function') {
  failures.push('Missing export: createBossDirector');
}

// Must export tickBossDirector
if (typeof bd.tickBossDirector !== 'function') {
  failures.push('Missing export: tickBossDirector');
}

// Must export isBossAlive or equivalent
if (typeof bd.isBossAlive !== 'function' && typeof bd.getActiveBoss !== 'function' && typeof bd.getBossShips !== 'function') {
  failures.push('Missing boss liveness check (isBossAlive, getActiveBoss, or getBossShips)');
}

// Must export removeBoss or equivalent cleanup
if (typeof bd.removeBoss !== 'function' && typeof bd.onBossDefeated !== 'function') {
  failures.push('Missing boss removal (removeBoss or onBossDefeated)');
}

// createBossDirector must return a plain object (not a class instance with prototype chains)
const director = bd.createBossDirector();
if (director === null || typeof director !== 'object') {
  failures.push('createBossDirector did not return an object');
}

// Must have a spawn function
if (typeof bd.spawnBoss !== 'function') {
  failures.push('Missing export: spawnBoss');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Director follows established pattern with all required exports' }));
} else if (failures.length <= 2) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
