/**
 * Scenario: review_war_galleon_broadside_fires (weight: 5)
 * The War Galleon should fire a broadside volley of at least 4 heavy cannonballs
 * that collectively deal significant damage.
 */
import { createBossDirector, spawnBoss, tickBossDirector, getBossShips } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const director = createBossDirector();
const id = spawnBoss(director, 'war_galleon', 4, 4, { x: 500, y: 500 });
const bossShips = getBossShips(director);
const boss = bossShips[0];

// Place a player in close range within cannon arc
const player = createShip(600, 500, { id: 1, name: 'Player' });
player.alive = true;
player.doubloons = 0;

// Ensure the broadside timer is charged
if (boss && boss.cannonMountTimers) {
  // Already charged from creation
}

const bullets = [];
const spawnBullet = (b) => bullets.push(b);
const events = [];

// Tick several times to trigger a broadside (short dt to give AI time to aim)
for (let i = 0; i < 100; i++) {
  tickBossDirector(director, [player], 0.05, spawnBullet, events);
}

if (bullets.length < 4) {
  failures.push(`Expected at least 4 bullets from broadside, got ${bullets.length}`);
}

// Check total potential damage
const totalDamage = bullets.reduce((sum, b) => sum + (b.damage || 0), 0);
if (totalDamage < 30 && bullets.length >= 4) {
  failures.push(`Total broadside damage too low: ${totalDamage} (expected >= 30)`);
}

// Check bullets originate from boss position (not player)
for (const b of bullets) {
  if (b.x !== undefined && b.y !== undefined) {
    const distFromBoss = Math.hypot((b.x || 0) - boss.x, (b.y || 0) - boss.y);
    const distFromPlayer = Math.hypot((b.x || 0) - player.x, (b.y || 0) - player.y);
    if (distFromPlayer < distFromBoss && distFromBoss > 200) {
      failures.push('Bullets appear to originate from player, not boss');
      break;
    }
  }
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Broadside fired ${bullets.length} bullets with ${totalDamage} total damage` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
