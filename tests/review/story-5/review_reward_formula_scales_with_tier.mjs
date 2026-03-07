/**
 * Scenario: review_reward_formula_scales_with_tier (weight: 3)
 * Rewards should scale meaningfully and monotonically with boss tier.
 */
import { distributeBossKillRewards } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';

const failures = [];

const tiers = [2, 4, 6, 8, 10];
const rewards = [];

for (const tier of tiers) {
  const boss = { x: 1000, y: 1000, isBoss: true, hp: 0 };
  const killer = createShip(1000, 1050, { id: tier, name: `Killer-t${tier}` });
  killer.doubloons = 0;
  const result = distributeBossKillRewards(boss, killer, [killer], tier);
  rewards.push({ tier, doubloons: killer.doubloons, reported: result?.killerDoubloons });
}

// Rewards should increase monotonically
for (let i = 1; i < rewards.length; i++) {
  if (rewards[i].doubloons <= rewards[i - 1].doubloons) {
    failures.push(`Reward at tier ${rewards[i].tier} (${rewards[i].doubloons}) is not > tier ${rewards[i - 1].tier} (${rewards[i - 1].doubloons})`);
  }
}

// Tier 8 should be at least 1.5x tier 2
const tier2reward = rewards.find(r => r.tier === 2).doubloons;
const tier8reward = rewards.find(r => r.tier === 8).doubloons;
if (tier8reward < tier2reward * 1.5) {
  failures.push(`Tier 8 reward (${tier8reward}) is less than 1.5x tier 2 (${tier2reward})`);
}

// Rewards should be integers
for (const r of rewards) {
  if (r.doubloons !== Math.floor(r.doubloons)) {
    failures.push(`Tier ${r.tier} reward is not integer: ${r.doubloons}`);
  }
}

// Edge: tier 0 should still be positive
const boss0 = { x: 1000, y: 1000, isBoss: true, hp: 0 };
const killer0 = createShip(1000, 1050, { id: 100, name: 'Killer-t0' });
killer0.doubloons = 0;
try {
  distributeBossKillRewards(boss0, killer0, [killer0], 0);
  if (killer0.doubloons <= 0) {
    failures.push(`Tier 0 reward is not positive: ${killer0.doubloons}`);
  }
} catch (e) {
  failures.push(`Tier 0 threw error: ${e.message}`);
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `Rewards scale: ${rewards.map(r => `t${r.tier}=${r.doubloons}`).join(', ')}` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
