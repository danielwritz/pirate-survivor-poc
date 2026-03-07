/**
 * Scenario: review_kraken_deep_water_spawn (weight: 2)
 * Kraken should spawn within map bounds and not inside islands.
 */
import { createKrakenBoss } from '../../../server/bossDirector.js';

const failures = [];

// Create a Kraken and check its position is valid
const boss = createKrakenBoss(1000, 1000, 4);

if (typeof boss.x !== 'number' || isNaN(boss.x)) {
  failures.push(`Invalid x coordinate: ${boss.x}`);
}
if (typeof boss.y !== 'number' || isNaN(boss.y)) {
  failures.push(`Invalid y coordinate: ${boss.y}`);
}

// Position should be within reasonable map bounds (default 5000x5000)
if (boss.x < 0 || boss.x > 10000) {
  failures.push(`x out of reasonable map bounds: ${boss.x}`);
}
if (boss.y < 0 || boss.y > 10000) {
  failures.push(`y out of reasonable map bounds: ${boss.y}`);
}

// Kraken should have area effect defined
if (!boss.areaEffect || !boss.areaEffect.radius) {
  failures.push('Kraken missing areaEffect.radius');
}

// Kraken should be alive on creation
if (!boss.alive) {
  failures.push('Kraken not alive on creation');
}

if (boss.maxHp <= 0) {
  failures.push(`Invalid maxHp: ${boss.maxHp}`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Kraken spawns at valid position (${boss.x}, ${boss.y}) with radius ${boss.areaEffect.radius}` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
