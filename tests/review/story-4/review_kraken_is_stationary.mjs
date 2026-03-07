/**
 * Scenario: review_kraken_is_stationary (weight: 4)
 * Unlike other bosses, the Kraken does not move — it's a zone hazard.
 */
import { createKrakenBoss, tickKrakenBoss } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const boss = createKrakenBoss(1000, 1000, 4);
const startX = boss.x;
const startY = boss.y;

// Place players at various positions
const players = [
  createShip(1050, 1050, { id: 1, name: 'Near' }),
  createShip(500, 500, { id: 2, name: 'Far' }),
  createShip(1010, 990, { id: 3, name: 'Adjacent' })
];
players.forEach(p => { p.alive = true; p.hp = 100; p.maxHp = 100; });

// Tick 200 times
for (let i = 0; i < 200; i++) {
  tickKrakenBoss(boss, players, 0.05, []);
}

if (boss.x !== startX || boss.y !== startY) {
  failures.push(`Kraken moved from (${startX}, ${startY}) to (${boss.x}, ${boss.y})`);
}

// Check no velocity/heading properties cause movement
if (boss.vx && boss.vx !== 0) failures.push(`Kraken has non-zero vx: ${boss.vx}`);
if (boss.vy && boss.vy !== 0) failures.push(`Kraken has non-zero vy: ${boss.vy}`);

// Even with player standing right next to it, Kraken stays put
const adjacent = createShip(1001, 1001, { id: 10, name: 'RightHere' });
adjacent.alive = true; adjacent.hp = 100; adjacent.maxHp = 100;

for (let i = 0; i < 50; i++) {
  tickKrakenBoss(boss, [adjacent], 0.05, []);
}

if (boss.x !== startX || boss.y !== startY) {
  failures.push(`Kraken moved when player stood adjacent`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Kraken is stationary — position unchanged after 200 ticks' }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
