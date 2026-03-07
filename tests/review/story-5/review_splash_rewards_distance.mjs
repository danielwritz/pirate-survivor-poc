/**
 * Scenario: review_splash_rewards_distance (weight: 5)
 * Players near the boss kill get splash reward, players far away get nothing.
 * 300-unit radius cutoff.
 */
import { distributeBossKillRewards } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const boss = { x: 1000, y: 1000, isBoss: true, hp: 0 };

// Killer: 50 units away
const killer = createShip(1000, 1050, { id: 1, name: 'Killer' });
killer.doubloons = 0;

// Player B: 250 units away (within splash)
const playerB = createShip(1000, 1250, { id: 2, name: 'NearbyB' });
playerB.doubloons = 0;

// Player C: 800 units away (outside splash)
const playerC = createShip(1000, 1800, { id: 3, name: 'FarC' });
playerC.doubloons = 0;

const allPlayers = [killer, playerB, playerC];
const result = distributeBossKillRewards(boss, killer, allPlayers, 4);

// Killer should get full reward (80-100)
if (killer.doubloons < 80 || killer.doubloons > 100) {
  failures.push(`Killer reward ${killer.doubloons} outside expected range 80-100`);
}

// Player B (250 units, within 300 splash) should get ~30% of base
// Base = 90, splash = floor(90 * 0.3) = 27
if (playerB.doubloons < 15 || playerB.doubloons > 40) {
  failures.push(`Splash reward for nearby player: ${playerB.doubloons} (expected ~20-35)`);
}

// Player C (800 units, outside 300 splash) should get exactly 0
if (playerC.doubloons !== 0) {
  failures.push(`Distant player received ${playerC.doubloons} doubloons (expected 0)`);
}

// Player B should NOT get major upgrade offer (only killer)
if (playerB.majorOfferTriggered || (playerB.pendingMajorOffers && playerB.pendingMajorOffers > 0)) {
  failures.push('Nearby non-killer player incorrectly received major upgrade offer');
}

// Edge: player at boundary (300 units) should get splash
const boundaryPlayer = createShip(1000, 1300, { id: 4, name: 'Boundary' });
boundaryPlayer.doubloons = 0;
const boss2 = { x: 1000, y: 1000, isBoss: true, hp: 0 };
const killer4 = createShip(1000, 1050, { id: 5, name: 'Killer4' });
killer4.doubloons = 0;
distributeBossKillRewards(boss2, killer4, [killer4, boundaryPlayer], 4);
if (boundaryPlayer.doubloons === 0) {
  failures.push('Player at exactly 300 units away got no splash reward');
}

// Edge: player at 301 units should get nothing
const outsidePlayer = createShip(1000, 1301, { id: 6, name: 'Outside' });
outsidePlayer.doubloons = 0;
const boss3 = { x: 1000, y: 1000, isBoss: true, hp: 0 };
const killer5 = createShip(1000, 1050, { id: 7, name: 'Killer5' });
killer5.doubloons = 0;
distributeBossKillRewards(boss3, killer5, [killer5, outsidePlayer], 4);
if (outsidePlayer.doubloons > 0) {
  failures.push(`Player at 301 units got ${outsidePlayer.doubloons} splash reward (expected 0)`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Killer: ${killer.doubloons}, nearby splash: ${playerB.doubloons}, far: ${playerC.doubloons}` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
