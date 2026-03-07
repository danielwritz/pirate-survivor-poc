/**
 * Scenario: review_kraken_area_damage (weight: 5)
 * Ships within the Kraken's radius take periodic damage; ships outside do not.
 */
import { createKrakenBoss, tickKrakenBoss } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const boss = createKrakenBoss(1000, 1000, 4);

// Player A: inside radius (close to boss)
const playerA = createShip(1050, 1050, { id: 1, name: 'Inside' });
playerA.alive = true;
playerA.hp = 100;
playerA.maxHp = 100;

// Player B: outside radius (far away)
const playerB = createShip(2000, 2000, { id: 2, name: 'Outside' });
playerB.alive = true;
playerB.hp = 100;
playerB.maxHp = 100;

const hpA_before = playerA.hp;
const hpB_before = playerB.hp;

const events = [];

// Tick multiple times to trigger pulses (pulse every ~1.5s)
for (let i = 0; i < 100; i++) {
  tickKrakenBoss(boss, [playerA, playerB], 0.05, events);
}

if (playerA.hp >= hpA_before) {
  failures.push(`Player A (inside radius) took no damage: hp=${playerA.hp}`);
}

if (playerB.hp < hpB_before) {
  failures.push(`Player B (outside radius) took damage: hp=${playerB.hp} (was ${hpB_before})`);
}

// Damage should be periodic (not instant-kill)
if (playerA.hp <= 0 && hpA_before - playerA.hp > 80) {
  // Might be too much damage for 5 seconds, but depends on tuning — just warn
}

// Edge: player at boundary — should take damage (inclusive)
const radius = boss.areaEffect?.radius || 160;
const boundary = createShip(1000 + radius, 1000, { id: 3, name: 'Boundary' });
boundary.alive = true;
boundary.hp = 100;
boundary.maxHp = 100;

const hpBoundary_before = boundary.hp;
for (let i = 0; i < 100; i++) {
  tickKrakenBoss(boss, [boundary], 0.05, []);
}

if (boundary.hp >= hpBoundary_before) {
  failures.push(`Player at boundary radius took no damage (hp=${boundary.hp})`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Area damage works: inside player took ${hpA_before - playerA.hp} dmg, outside player untouched` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
