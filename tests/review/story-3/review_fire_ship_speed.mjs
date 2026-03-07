/**
 * Scenario: review_fire_ship_speed (weight: 3)
 * Fire Ship should be noticeably faster than a standard player ship.
 */
import { createFireShipBoss } from '../../../server/fireShipBoss.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const boss = createFireShipBoss(90001, 0, 0, 3, 4);
const player = createShip(0, 0, { id: 1, name: 'Player' });

// Compare baseSpeed or speed attribute
const bossSpeed = boss.baseSpeed || boss.speed || 0;
const playerSpeed = player.baseSpeed || player.speed || 0;

if (bossSpeed <= playerSpeed) {
  failures.push(`Fire Ship speed (${bossSpeed}) is not faster than player speed (${playerSpeed})`);
}

// Speed should be fast but not teleporting (reasonable upper bound)
if (bossSpeed > playerSpeed * 5) {
  failures.push(`Fire Ship speed (${bossSpeed}) seems unreasonably fast — ${(bossSpeed/playerSpeed).toFixed(1)}x player speed`);
}

// Check that speed comes from a constant, not hardcoded
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');
const constantsSrc = readFileSync(join(root, 'shared/constants.js'), 'utf8');

if (!constantsSrc.includes('FIRE_SHIP_SPEED_MUL') && !constantsSrc.includes('FIRE_SHIP_SPEED')) {
  failures.push('Fire Ship speed constant not found in shared/constants.js');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Fire Ship is ${(bossSpeed/playerSpeed).toFixed(2)}x faster than player ship` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
