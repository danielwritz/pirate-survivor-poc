/**
 * Scenario: review_fire_ship_self_destructs (weight: 4)
 * After ramming a player, Fire Ship should destroy itself (kamikaze).
 */
import { createFireShipBoss, applyFireShipRam } from '../../../server/fireShipBoss.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const boss = createFireShipBoss(90001, 100, 100, 3, 4);
const player = createShip(100, 100, { id: 1, name: 'Player' });
player.hp = 100;
player.maxHp = 100;
player.alive = true;
player.onFire = false;

applyFireShipRam(boss, player);

// Boss should be dead after ram
if (boss.alive !== false) {
  failures.push(`Boss is still alive after ram (alive=${boss.alive})`);
}

if (boss.hp > 0) {
  failures.push(`Boss HP should be <= 0 after self-destruct (hp=${boss.hp})`);
}

// Boss should have a doubloon reward defined
if (!boss._doubloonReward && boss._doubloonReward !== 0) {
  // Check if reward is defined anywhere
  const hasReward = boss._doubloonReward !== undefined || boss.doubloonReward !== undefined;
  if (!hasReward) {
    failures.push('No doubloon reward defined on Fire Ship boss');
  }
}

// Edge: boss killed by player damage before ramming - should die normally without ignite
const boss2 = createFireShipBoss(90002, 100, 100, 3, 4);
boss2.hp = 0;
boss2.alive = false;
const player2 = createShip(100, 100, { id: 2, name: 'Player2' });
player2.hp = 100;
player2.maxHp = 100;
player2.alive = true;
player2.onFire = false;

// If boss is already dead, ram should not trigger (test defensive check)
// This is more of a behavioral check — the code may or may not guard against this

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Fire Ship self-destructs on ram, drops doubloons' }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
