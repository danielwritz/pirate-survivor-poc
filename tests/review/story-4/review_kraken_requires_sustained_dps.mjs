/**
 * Scenario: review_kraken_requires_sustained_dps (weight: 3)
 * Kraken should have enough HP that it can't be burst down instantly.
 */
import { createKrakenBoss } from '../../../server/bossDirector.js';

const failures = [];

// Tier 8 Kraken with 6 players
const boss = createKrakenBoss(1000, 1000, 8);

// Assume max player cannon damage around 8-15 per hit
const maxPlayerDamage = 15; // generous upper bound for a single cannon hit
const hitsToKill = Math.ceil(boss.maxHp / maxPlayerDamage);

if (hitsToKill < 10) {
  failures.push(`Kraken HP (${boss.maxHp}) can be killed in only ${hitsToKill} hits at ${maxPlayerDamage} dmg/hit — too squishy`);
}

// Tier 2 Kraken should still be substantial
const earlyBoss = createKrakenBoss(1000, 1000, 2);
if (earlyBoss.maxHp < 200) {
  failures.push(`Tier 2 Kraken HP (${earlyBoss.maxHp}) is too low — should be substantial`);
}

// Kraken HP should scale with tier
const tier4 = createKrakenBoss(1000, 1000, 4);
const tier6 = createKrakenBoss(1000, 1000, 6);
if (tier6.maxHp <= tier4.maxHp) {
  failures.push(`Kraken HP does not scale with tier: tier4=${tier4.maxHp}, tier6=${tier6.maxHp}`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Tier 8 Kraken has ${boss.maxHp} HP, requires ~${hitsToKill} hits to kill` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
