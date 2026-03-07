/**
 * Scenario: review_war_galleon_size_and_stats (weight: 3)
 * The War Galleon should be visually imposing — significantly larger and tougher
 * than a player ship.
 */
import { createBossDirector, spawnBoss, getBossShips } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const director = createBossDirector();
spawnBoss(director, 'war_galleon', 4, 6, { x: 500, y: 500 });
const bossShips = getBossShips(director);
const boss = bossShips[0];

// Create a player ship for comparison
const player = createShip(0, 0, { id: 1, name: 'Player' });

if (!boss) {
  failures.push('War Galleon boss was not created');
} else {
  // Size check: should be >= 2.5x player size
  const sizeRatio = boss.size / player.size;
  if (sizeRatio < 2.5) {
    failures.push(`Boss size ratio ${sizeRatio.toFixed(2)}x is less than 2.5x player size`);
  }

  // HP check: should be substantially higher than a level-10 player's maxHp
  if (boss.maxHp <= player.maxHp * 2) {
    failures.push(`Boss HP ${boss.maxHp} is not substantially higher than player HP ${player.maxHp}`);
  }

  // Archetype identifier check
  if (boss.bossArchetype !== 'war_galleon') {
    failures.push(`Expected bossArchetype 'war_galleon', got '${boss.bossArchetype}'`);
  }

  // Tier 2 check (first boss scenario): still noticeably larger
  const dir2 = createBossDirector();
  spawnBoss(dir2, 'war_galleon', 2, 1, { x: 100, y: 100 });
  const earlyBoss = getBossShips(dir2)[0];
  if (earlyBoss && earlyBoss.size < player.size * 2) {
    failures.push(`Tier 2 boss size ${earlyBoss.size} not noticeably larger than player size ${player.size}`);
  }
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'War Galleon is appropriately imposing in size and stats' }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
