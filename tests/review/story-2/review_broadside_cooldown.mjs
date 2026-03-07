/**
 * Scenario: review_broadside_cooldown (weight: 3)
 * War Galleon should fire broadsides on a cooldown (~4 seconds), not every tick.
 */
import { createBossDirector, spawnBoss, tickBossDirector, getBossShips } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const director = createBossDirector();
spawnBoss(director, 'war_galleon', 4, 4, { x: 500, y: 500 });
const boss = getBossShips(director)[0];

// Place player very close and in arc to guarantee broadside opportunities
const player = createShip(600, 500, { id: 1, name: 'Player' });
player.alive = true;
player.hp = 1000;
player.maxHp = 1000;

// Count distinct broadside events over 10 seconds (200 ticks at 20Hz)
let broadsideCount = 0;
let lastBulletCount = 0;
const allBullets = [];
const spawnBullet = (b) => allBullets.push(b);
const events = [];

for (let i = 0; i < 200; i++) {
  const beforeBullets = allBullets.length;
  tickBossDirector(director, [player], 0.05, spawnBullet, events);
  // Count a broadside if multiple bullets were spawned in this tick
  const newBullets = allBullets.length - beforeBullets;
  if (newBullets >= 3) {
    broadsideCount++;
  }
}

// Also count bossBroadside events if emitted
const broadsideEvents = events.filter(e => e.type === 'bossBroadside');
const detectedVolleys = Math.max(broadsideCount, broadsideEvents.length);

if (detectedVolleys > 5) {
  failures.push(`Too many broadside volleys in 10 seconds: ${detectedVolleys} (expected 2-3, cooldown ~4s)`);
}

if (detectedVolleys === 0 && allBullets.length === 0) {
  failures.push('No broadside fired at all in 10 seconds');
}

if (allBullets.length >= 200) {
  failures.push(`Appears to fire every tick (${allBullets.length} bullets) — no cooldown`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `${detectedVolleys} broadside volleys in 10 seconds with ${allBullets.length} total bullets — cooldown working` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
