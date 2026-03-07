/**
 * Scenario: review_power_ratio_early_vs_late (weight: 4)
 * A max-level ship should feel dramatically more powerful than a level-1 ship.
 */
import { createShip } from '../../../shared/shipState.js';
import { XP_START, XP_SCALE, XP_ADD, BASE_HP, BASE_SIZE } from '../../../shared/constants.js';

const failures = [];

// Create level 1 ship
const lvl1 = createShip(0, 0, { id: 1, name: 'Level1' });

// Simulate level 20 ship: apply level growth manually
const lvl20 = createShip(0, 0, { id: 2, name: 'Level20' });
for (let i = 2; i <= 20; i++) {
  lvl20.level = i;
  lvl20.size += 0.6;
  lvl20.maxHp += 2;
  lvl20.hp = lvl20.maxHp;
}

// HP check: level 20 maxHp should be at least 2.5x level 1
const hpRatio = lvl20.maxHp / lvl1.maxHp;
if (hpRatio < 2.5) {
  failures.push(`Level 20 HP ratio only ${hpRatio.toFixed(2)}x (expected >= 2.5x). L1=${lvl1.maxHp}, L20=${lvl20.maxHp}`);
}

// Size check: level 20 size should be at least 1.5x level 1
const sizeRatio = lvl20.size / lvl1.size;
if (sizeRatio < 1.5) {
  failures.push(`Level 20 size ratio only ${sizeRatio.toFixed(2)}x (expected >= 1.5x). L1=${lvl1.size}, L20=${lvl20.size}`);
}

// Level 20 base stats represent meaningful power growth
if (lvl20.maxHp <= lvl1.maxHp + 10) {
  failures.push(`Level 20 HP (${lvl20.maxHp}) is barely higher than level 1 (${lvl1.maxHp})`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Power ratio: HP ${hpRatio.toFixed(1)}x, size ${sizeRatio.toFixed(1)}x at level 20` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
