/**
 * Scenario: review_fire_ship_chases_highest_scorer (weight: 4)
 * Fire Ship should aggressively pursue the player with the highest score.
 */
import { createFireShipBoss, tickFireShipBoss } from '../../../server/fireShipBoss.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const boss = createFireShipBoss(90001, 0, 0, 3, 4);
boss.heading = 0;

// Player A: higher score, farther away
const playerA = createShip(300, 0, { id: 1, name: 'HighScorer' });
playerA.alive = true;
playerA.doubloons = 500;

// Player B: lower score, closer
const playerB = createShip(100, 0, { id: 2, name: 'LowScorer' });
playerB.alive = true;
playerB.doubloons = 100;

const players = [playerA, playerB];
const world = { width: 5000, height: 5000 };

const startX = boss.x;

// Tick many times, manually moving boss based on _input
for (let i = 0; i < 100; i++) {
  tickFireShipBoss(boss, players, world, [], 0.05);
  if (!boss.alive) break; // collided
  // Apply simple movement from _input
  if (boss._input) {
    const speed = boss.baseSpeed || 3;
    boss.x += Math.cos(boss.heading) * speed * 0.05;
    boss.y += Math.sin(boss.heading) * speed * 0.05;
    if (boss._input.turn) boss.heading += boss._input.turn * 0.1;
    if (boss._input.turnRight) boss.heading += 0.05;
    if (boss._input.turnLeft) boss.heading -= 0.05;
  }
}

if (boss.alive) {
  const distToA = Math.hypot(boss.x - playerA.x, boss.y - playerA.y);
  const distToB = Math.hypot(boss.x - playerB.x, boss.y - playerB.y);

  if (distToA > distToB + 50) {
    failures.push(`Boss moved toward low scorer instead of high scorer (dist to A: ${distToA.toFixed(0)}, dist to B: ${distToB.toFixed(0)})`);
  }
}

// Edge: with 0 players, should not crash
try {
  const boss2 = createFireShipBoss(90002, 0, 0, 2, 1);
  tickFireShipBoss(boss2, [], world, [], 0.05);
} catch (e) {
  failures.push(`Crashed with 0 players: ${e.message}`);
}

// Edge: equal scores — should pick someone (not freeze)
const eqA = createShip(300, 0, { id: 10, name: 'EqA' });
eqA.alive = true; eqA.doubloons = 100;
const eqB = createShip(0, 300, { id: 11, name: 'EqB' });
eqB.alive = true; eqB.doubloons = 100;
const boss3 = createFireShipBoss(90003, 0, 0, 2, 2);
try {
  tickFireShipBoss(boss3, [eqA, eqB], world, [], 0.05);
} catch (e) {
  failures.push(`Crashed with equal scores: ${e.message}`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Fire Ship correctly chases highest scorer' }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
