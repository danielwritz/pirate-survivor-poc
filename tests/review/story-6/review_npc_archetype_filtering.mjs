/**
 * Scenario: review_npc_archetype_filtering (weight: 5)
 * Verify NPC archetype pools are correctly filtered by stage.
 */
import { getAllowedArchetypes } from '../../shared/stages.js';

const failures = [];

// Calm Waters (t=60): only weak + standard
const calm = getAllowedArchetypes(60);
if (!calm.includes('weak'))       failures.push('Calm: missing weak');
if (!calm.includes('standard'))   failures.push('Calm: missing standard');
if (calm.includes('heavy'))       failures.push('Calm: should NOT include heavy');
if (calm.includes('scavenger'))   failures.push('Calm: should NOT include scavenger');
if (calm.length === 0)            failures.push('Calm: empty pool');

// Contested Seas (t=120): + heavy
const contested = getAllowedArchetypes(120);
if (!contested.includes('heavy')) failures.push('Contested: missing heavy');
if (contested.includes('scavenger')) failures.push('Contested: should NOT include scavenger');

// War Zone (t=300): + scavenger
const war = getAllowedArchetypes(300);
if (!war.includes('heavy'))     failures.push('War: missing heavy');
if (!war.includes('scavenger')) failures.push('War: missing scavenger');

// Kraken Frontier (t=480): all types
const kraken = getAllowedArchetypes(480);
if (kraken.length < 4) failures.push(`Kraken: expected >=4 archetypes, got ${kraken.length}`);

// Edge: no stage should have an empty pool
for (const t of [0, 120, 300, 480]) {
  const pool = getAllowedArchetypes(t);
  if (!pool || pool.length === 0) failures.push(`t=${t}: empty pool`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'All stage archetype pools correct' }));
} else if (failures.length <= 2) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
