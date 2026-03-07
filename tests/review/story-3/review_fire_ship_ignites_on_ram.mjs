/**
 * Scenario: review_fire_ship_ignites_on_ram (weight: 5)
 * Fire Ship's core mechanic: ram-and-ignite. Player must take damage AND catch fire.
 */
import { createFireShipBoss, applyFireShipRam } from '../../../server/fireShipBoss.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const boss = createFireShipBoss(90001, 100, 100, 3, 4);
const player = createShip(100, 100, { id: 1, name: 'Player' });
player.hp = 50;
player.maxHp = 100;
player.alive = true;
player.onFire = false;

const hpBefore = player.hp;
applyFireShipRam(boss, player);

if (player.hp >= hpBefore) {
  failures.push(`Player HP did not decrease: ${player.hp} (was ${hpBefore})`);
}

if (!player.onFire) {
  failures.push('Player is not on fire after ram');
}

// Fire duration should be extended (>= normal base duration ticks)
if (player.fireTicks !== undefined && player.fireTicks < 10) {
  failures.push(`Fire ticks too low: ${player.fireTicks} (expected extended duration)`);
}

// Edge: player at 1 HP should die from ram
const dyingPlayer = createShip(100, 100, { id: 2, name: 'Dying' });
dyingPlayer.hp = 1;
dyingPlayer.maxHp = 100;
dyingPlayer.alive = true;
dyingPlayer.onFire = false;

const boss2 = createFireShipBoss(90002, 100, 100, 3, 4);
applyFireShipRam(boss2, dyingPlayer);
if (dyingPlayer.hp > 0) {
  failures.push(`1 HP player survived ram (hp=${dyingPlayer.hp})`);
}

// Edge: player already on fire — fire should reset/extend
const alreadyBurning = createShip(100, 100, { id: 3, name: 'Burning' });
alreadyBurning.hp = 80;
alreadyBurning.maxHp = 100;
alreadyBurning.alive = true;
alreadyBurning.onFire = true;
alreadyBurning.fireTicks = 2;

const boss3 = createFireShipBoss(90003, 100, 100, 3, 4);
applyFireShipRam(boss3, alreadyBurning);
if (alreadyBurning.fireTicks <= 2) {
  failures.push(`Fire ticks not reset/extended for already-burning player: ${alreadyBurning.fireTicks}`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Ram-and-ignite works correctly, fire applied and damage dealt' }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
