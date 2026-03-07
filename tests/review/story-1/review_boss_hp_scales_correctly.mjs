/**
 * Scenario: review_boss_hp_scales_correctly (weight: 4)
 * Boss HP should increase with both difficulty tier and player count.
 */
import { computeBossHp } from '../../../server/bossDirector.js';

const failures = [];

let hp_t2_p1, hp_t2_p10, hp_t8_p1, hp_t8_p10;
try {
  hp_t2_p1  = computeBossHp(2, 1);
  hp_t2_p10 = computeBossHp(2, 10);
  hp_t8_p1  = computeBossHp(8, 1);
  hp_t8_p10 = computeBossHp(8, 10);
} catch (e) {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: `computeBossHp threw: ${e.message}` }));
  process.exit(0);
}

// HP increases when tier increases (same player count)
if (hp_t8_p1 <= hp_t2_p1) {
  failures.push(`HP should increase with tier: tier8/1p=${hp_t8_p1} <= tier2/1p=${hp_t2_p1}`);
}

// HP increases when player count increases (same tier)
if (hp_t2_p10 <= hp_t2_p1) {
  failures.push(`HP should increase with players: tier2/10p=${hp_t2_p10} <= tier2/1p=${hp_t2_p1}`);
}

// Lowest HP is reasonable (> 50)
if (hp_t2_p1 <= 50) {
  failures.push(`Lowest HP ${hp_t2_p1} is too low (should be > 50)`);
}

// Highest HP is significantly larger (> 5x the lowest)
if (hp_t8_p10 < hp_t2_p1 * 5) {
  failures.push(`Highest HP ${hp_t8_p10} is not 5x lowest ${hp_t2_p1}`);
}

// Edge: 0 players should not produce NaN or negative
const hp0 = computeBossHp(2, 0);
if (!Number.isFinite(hp0) || hp0 < 0) {
  failures.push(`0 players produced invalid HP: ${hp0}`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Boss HP scales correctly with tier and player count' }));
} else if (failures.length === 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
