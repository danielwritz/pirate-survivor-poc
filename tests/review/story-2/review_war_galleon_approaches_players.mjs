/**
 * Scenario: review_war_galleon_approaches_players (weight: 4)
 * War Galleon should navigate toward player clusters, not wander randomly.
 */
import { createBossDirector, spawnBoss, tickBossDirector, getBossShips } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const director = createBossDirector();
spawnBoss(director, 'war_galleon', 4, 4, { x: 0, y: 0 });
const boss = getBossShips(director)[0];

// 3 players clustered at (500, 500), 1 outlier at (2000, 2000)
const cluster = [
  createShip(480, 500, { id: 1, name: 'A' }),
  createShip(500, 520, { id: 2, name: 'B' }),
  createShip(520, 480, { id: 3, name: 'C' })
];
const outlier = createShip(2000, 2000, { id: 4, name: 'D' });
const players = [...cluster, outlier];
players.forEach(p => { p.alive = true; });

const startX = boss.x;
const startY = boss.y;

const bullets = [];
const spawnBullet = (b) => bullets.push(b);

// Tick many times to let the boss move
for (let i = 0; i < 200; i++) {
  tickBossDirector(director, players, 0.05, spawnBullet, []);
  // Apply simple physics to boss based on _input
  if (boss._input) {
    const speed = 2;
    if (boss._input.forward) {
      boss.x += Math.cos(boss.heading) * speed * 0.05;
      boss.y += Math.sin(boss.heading) * speed * 0.05;
    }
    if (boss._input.turnRight) boss.heading += 0.05;
    if (boss._input.turnLeft) boss.heading -= 0.05;
  }
}

const distToCluster = Math.hypot(boss.x - 500, boss.y - 500);
const distToOutlier = Math.hypot(boss.x - 2000, boss.y - 2000);
const distFromStart = Math.hypot(boss.x - startX, boss.y - startY);

if (distFromStart < 5) {
  failures.push('Boss did not move from starting position');
}

if (distToCluster > distToOutlier) {
  failures.push(`Boss moved toward outlier (dist to cluster: ${distToCluster.toFixed(0)}, dist to outlier: ${distToOutlier.toFixed(0)})`);
}

// Edge: with 1 player, boss should move toward that player
const dir2 = createBossDirector();
spawnBoss(dir2, 'war_galleon', 2, 1, { x: 0, y: 0 });
const soloBoss = getBossShips(dir2)[0];
const soloPlayer = createShip(500, 0, { id: 10, name: 'Solo' });
soloPlayer.alive = true;
const startX2 = soloBoss.x;

for (let i = 0; i < 100; i++) {
  tickBossDirector(dir2, [soloPlayer], 0.05, () => {}, []);
  if (soloBoss._input && soloBoss._input.forward) {
    soloBoss.x += Math.cos(soloBoss.heading) * 2 * 0.05;
    soloBoss.y += Math.sin(soloBoss.heading) * 2 * 0.05;
  }
  if (soloBoss._input && soloBoss._input.turnRight) soloBoss.heading += 0.05;
  if (soloBoss._input && soloBoss._input.turnLeft) soloBoss.heading -= 0.05;
}

if (Math.abs(soloBoss.x - startX2) < 1) {
  failures.push('Solo scenario: boss did not move toward single player');
}

// Edge: with 0 players, should not crash
try {
  const dir3 = createBossDirector();
  spawnBoss(dir3, 'war_galleon', 2, 1, { x: 0, y: 0 });
  tickBossDirector(dir3, [], 0.05, () => {}, []);
} catch (e) {
  failures.push(`Crashed with 0 players: ${e.message}`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'War Galleon approaches player clusters correctly' }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
