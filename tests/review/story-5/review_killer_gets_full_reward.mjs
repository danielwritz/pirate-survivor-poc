/**
 * Scenario: review_killer_gets_full_reward (weight: 5)
 * The player who lands the killing blow gets full doubloon reward + major upgrade offer.
 */
import { distributeBossKillRewards } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

// Create a boss at tier 4 with minimal HP (just killed)
const boss = { x: 1000, y: 1000, isBoss: true, hp: 0 };

const killer = createShip(1000, 1050, { id: 1, name: 'Killer' });
killer.doubloons = 0;

const result = distributeBossKillRewards(boss, killer, [killer], 4);

// Killer should get approximately 50 + 10*4 = 90 doubloons (within 80-100 range)
if (killer.doubloons < 80 || killer.doubloons > 100) {
  failures.push(`Tier 4 killer reward ${killer.doubloons} outside expected range 80-100`);
}

// Result should report the reward
if (result && result.killerDoubloons !== undefined) {
  if (result.killerDoubloons < 80 || result.killerDoubloons > 100) {
    failures.push(`Reported killerDoubloons ${result.killerDoubloons} outside expected range`);
  }
}

// Killer should have major offer triggered
if (!killer.majorOfferTriggered && !killer.pendingMajorOffers) {
  failures.push('Killer did not receive major upgrade offer');
}

// Edge: tier 2 should be smaller
const boss2 = { x: 1000, y: 1000, isBoss: true, hp: 0 };
const killer2 = createShip(1000, 1050, { id: 2, name: 'Killer2' });
killer2.doubloons = 0;
const result2 = distributeBossKillRewards(boss2, killer2, [killer2], 2);
if (killer2.doubloons >= killer.doubloons) {
  failures.push(`Tier 2 reward (${killer2.doubloons}) should be less than tier 4 (${killer.doubloons})`);
}

// Edge: adding to existing doubloons should work
const killer3 = createShip(1000, 1050, { id: 3, name: 'Rich' });
killer3.doubloons = 500;
const boss3 = { x: 1000, y: 1000, isBoss: true, hp: 0 };
distributeBossKillRewards(boss3, killer3, [killer3], 4);
if (killer3.doubloons <= 500) {
  failures.push(`Reward not added to existing doubloons (${killer3.doubloons})`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Killer received ${killer.doubloons} doubloons and major offer at tier 4` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
