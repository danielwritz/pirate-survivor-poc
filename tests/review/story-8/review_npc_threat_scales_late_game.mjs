/**
 * Scenario: review_npc_threat_scales_late_game (weight: 4)
 * Late-game NPCs should still pose a real threat to leveled players.
 */
import { createShip } from '../../../shared/shipState.js';
import { MAX_NPCS, NPC_SPAWN_INTERVAL_BASE } from '../../../shared/constants.js';

const failures = [];

// Verify constants have been tuned from defaults
// Original: MAX_NPCS=20, NPC_SPAWN_INTERVAL_BASE=3.5
// Expected: at least slightly increased density
if (MAX_NPCS < 20) {
  failures.push(`MAX_NPCS (${MAX_NPCS}) is lower than original (20) — should increase NPC density`);
}

if (NPC_SPAWN_INTERVAL_BASE > 3.5) {
  failures.push(`NPC_SPAWN_INTERVAL_BASE (${NPC_SPAWN_INTERVAL_BASE}) is higher than original (3.5) — should spawn faster`);
}

// Create a level-18 player ship
const player = createShip(0, 0, { id: 1, name: 'Veteran' });
for (let i = 2; i <= 18; i++) {
  player.level = i;
  player.size += 0.6;
  player.maxHp += 2;
  player.hp = player.maxHp;
}

// Create a tier-10 NPC (10 upgrades worth of stats — simulate HP scaling)
const npc = createShip(100, 0, { id: 2, name: 'Elite NPC', isNpc: true });
// Apply simulated NPC upgrades: +2 HP per upgrade level
for (let i = 0; i < 10; i++) {
  npc.maxHp += 3;
  npc.hp = npc.maxHp;
  npc.bulletDamage = (npc.bulletDamage || 2) + 0.5;
}

// NPC should deal meaningful damage to player (at least 10% of HP in a few hits)
const npcDmg = npc.bulletDamage || 2;
const hitsFor10Pct = Math.ceil(player.maxHp * 0.1 / npcDmg);

if (hitsFor10Pct > 20) {
  failures.push(`NPC needs ${hitsFor10Pct} hits to deal 10% HP — too weak against level 18 player`);
}

// NPC should survive at least 3 player cannon hits (default ~2 damage per shot)
const playerBaseDmg = 2; // BASE_BULLET_DAMAGE
const playerHitsToKill = Math.ceil(npc.maxHp / playerBaseDmg);
if (playerHitsToKill < 3) {
  failures.push(`Level-18 player kills tier-10 NPC in ${playerHitsToKill} hits — too squishy`);
}

// Tier-1 NPC facing level-18 should be relatively weak (this IS correct)
const weakNpc = createShip(100, 0, { id: 3, name: 'Weak NPC', isNpc: true });
const weakKill = Math.ceil(weakNpc.maxHp / playerBaseDmg);
// This should be fast — tier 1 NPCs are pushovers for veterans (expected behavior)

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: `NPC threat scales: tier-10 NPC deals ${npcDmg}/hit, survives ${playerHitsToKill} player hits` }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
