/**
 * NPC Director — spawns, manages AI, and scales difficulty for NPC enemy ships.
 * Server-side only.
 *
 * 2 archetypes: Standard (broadside fighter) and Heavy (tougher, more cannons).
 * NPCs use the same ship-as-JSON as players. Difficulty = # of random upgrades.
 */

import { createShip } from '../shared/shipState.js';
import { normalizeWeaponLayout, syncArmamentDerivedStats } from '../src/core/armament.js';
import { forwardVector } from '../shared/physics.js';
import { fireCannonBroadside } from '../shared/combat.js';
import { getGunRange, getCannonRange } from '../shared/shipState.js';
import { scaleNpcWithUpgrades, initStarterLoadout } from './upgradeDirector.js';
import {
  MAX_NPCS, NPC_SPAWN_INTERVAL_BASE,
  NPC_BASE_DOUBLOON_REWARD, NPC_DOUBLOON_PER_UPGRADE,
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_EDGE_PAD
} from '../shared/constants.js';

let nextNpcId = 10000;

// ─── NPC Archetypes ───

const ARCHETYPE = {
  standard: {
    name: 'Pirate',
    speedMul: 1.0,
    extraGunners: 0,
    extraCannons: 0,
    hullColor: '#5f4630',
    sailColor: '#e8dcc8'
  },
  heavy: {
    name: 'Raider',
    speedMul: 0.85,
    extraGunners: 2,
    extraCannons: 1,
    sizeMul: 1.25,
    massMul: 1.5,
    hpMul: 2.1,
    hullColor: '#4a3828',
    sailColor: '#c8b89a'
  }
};

/**
 * Create the NPC director state.
 */
export function createNpcDirector() {
  return {
    npcs: new Map(),         // npcId → { ship, aiState }
    spawnTimer: 2.0,         // start spawning after 2s
    difficultyTimer: 0,
    currentUpgradeCount: 0   // increases over time
  };
}

/**
 * Spawn an NPC ship at a position far from players.
 */
export function spawnNpc(director, playerPositions, roundTime) {
  const id = nextNpcId++;

  // Pick archetype (70% standard, 30% heavy)
  const archetype = Math.random() < 0.7 ? ARCHETYPE.standard : ARCHETYPE.heavy;

  // Spawn at a random edge
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  switch (edge) {
    case 0: x = WORLD_EDGE_PAD + 20; y = WORLD_EDGE_PAD + Math.random() * (WORLD_HEIGHT - WORLD_EDGE_PAD * 2); break;
    case 1: x = WORLD_WIDTH - WORLD_EDGE_PAD - 20; y = WORLD_EDGE_PAD + Math.random() * (WORLD_HEIGHT - WORLD_EDGE_PAD * 2); break;
    case 2: x = WORLD_EDGE_PAD + Math.random() * (WORLD_WIDTH - WORLD_EDGE_PAD * 2); y = WORLD_EDGE_PAD + 20; break;
    default: x = WORLD_EDGE_PAD + Math.random() * (WORLD_WIDTH - WORLD_EDGE_PAD * 2); y = WORLD_HEIGHT - WORLD_EDGE_PAD - 20; break;
  }

  // Try to spawn far from all players
  if (playerPositions.length > 0) {
    let bestX = x, bestY = y, bestMinDist = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      const e = Math.floor(Math.random() * 4);
      let cx, cy;
      switch (e) {
        case 0: cx = WORLD_EDGE_PAD + 30; cy = WORLD_EDGE_PAD + Math.random() * (WORLD_HEIGHT - WORLD_EDGE_PAD * 2); break;
        case 1: cx = WORLD_WIDTH - WORLD_EDGE_PAD - 30; cy = WORLD_EDGE_PAD + Math.random() * (WORLD_HEIGHT - WORLD_EDGE_PAD * 2); break;
        case 2: cx = WORLD_EDGE_PAD + Math.random() * (WORLD_WIDTH - WORLD_EDGE_PAD * 2); cy = WORLD_EDGE_PAD + 30; break;
        default: cx = WORLD_EDGE_PAD + Math.random() * (WORLD_WIDTH - WORLD_EDGE_PAD * 2); cy = WORLD_HEIGHT - WORLD_EDGE_PAD - 30; break;
      }
      let minDist = Infinity;
      for (const p of playerPositions) {
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestX = cx;
        bestY = cy;
      }
    }
    x = bestX;
    y = bestY;
  }

  // Create ship
  const ship = createShip(x, y, { id, name: archetype.name, isNpc: true });
  initStarterLoadout(ship);

  // Apply archetype modifiers
  if (archetype.sizeMul) ship.size *= archetype.sizeMul;
  if (archetype.massMul) ship.mass *= archetype.massMul;
  if (archetype.hpMul) { ship.maxHp *= archetype.hpMul; ship.hp = ship.maxHp; }
  ship.baseSpeed *= archetype.speedMul;
  ship.gunners += archetype.extraGunners;
  ship.crew += archetype.extraGunners;
  if (archetype.extraCannons > 0) {
    // Will be handled by upgrade application
  }
  ship.hullColor = archetype.hullColor;
  ship.sailColor = archetype.sailColor;
  ship.invulnTimer = 0; // NPCs don't get spawn invuln

  // Apply difficulty upgrades
  const upgradeCount = director.currentUpgradeCount;
  scaleNpcWithUpgrades(ship, upgradeCount);

  // Doubloon reward scales with upgrade count
  ship._doubloonReward = NPC_BASE_DOUBLOON_REWARD + upgradeCount * NPC_DOUBLOON_PER_UPGRADE + Math.floor(Math.random() * 3);

  // AI state
  const aiState = {
    mode: 'approach',     // approach | broadside | fire | unstick
    targetId: null,
    stuckTimer: 0,
    modeTimer: 0,
    lastX: x,
    lastY: y
  };

  director.npcs.set(id, { ship, aiState });
  return id;
}

/**
 * Remove an NPC.
 */
export function removeNpc(director, npcId) {
  director.npcs.delete(npcId);
}

/**
 * Tick the NPC director: spawn new NPCs, run AI, update difficulty.
 */
export function tickNpcDirector(director, playerShips, world, dt, roundTime, spawnBullet) {
  // Difficulty ramp: +1 upgrade per 60 seconds of round time
  director.currentUpgradeCount = Math.floor(roundTime / 60);

  // Spawn timer
  const spawnInterval = Math.max(1.5, NPC_SPAWN_INTERVAL_BASE - roundTime * 0.004);
  director.spawnTimer -= dt;
  if (director.spawnTimer <= 0 && director.npcs.size < MAX_NPCS && playerShips.length > 0) {
    director.spawnTimer = spawnInterval;
    const positions = playerShips.map(s => ({ x: s.x, y: s.y }));
    spawnNpc(director, positions, roundTime);
  }

  // Tick each NPC
  for (const [npcId, npc] of director.npcs) {
    if (!npc.ship.alive) continue;
    tickNpcAi(npc, playerShips, world, dt, spawnBullet);
  }
}

// ─── NPC AI ───

function tickNpcAi(npc, playerShips, world, dt, spawnBullet) {
  const ship = npc.ship;
  const ai = npc.aiState;

  // Find nearest player
  let nearest = null;
  let nearestDist = Infinity;
  for (const target of playerShips) {
    if (!target.alive) continue;
    const d = Math.hypot(target.x - ship.x, target.y - ship.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = target;
    }
  }

  if (!nearest) {
    // No targets — wander
    ship._input = { forward: true, brake: false, turnLeft: false, turnRight: false, sailOpen: true, anchored: false };
    return;
  }

  const dx = nearest.x - ship.x;
  const dy = nearest.y - ship.y;
  const dist = nearestDist;
  const angleToTarget = Math.atan2(dy, dx);
  const fwd = forwardVector(ship.heading);
  const gunRange = getGunRange(ship);
  const cannonRange = getCannonRange(ship);

  // Stuck detection
  const moved = Math.hypot(ship.x - ai.lastX, ship.y - ai.lastY);
  ai.lastX = ship.x;
  ai.lastY = ship.y;
  if (moved < 0.3 * dt * 60 && ship.speed < 0.3) {
    ai.stuckTimer += dt;
  } else {
    ai.stuckTimer = Math.max(0, ai.stuckTimer - dt * 2);
  }

  if (ai.stuckTimer > 1.5) {
    ai.mode = 'unstick';
    ai.modeTimer = 1.5;
    ai.stuckTimer = 0;
  }

  // Mode timer
  ai.modeTimer = Math.max(0, (ai.modeTimer || 0) - dt);

  // State machine
  const input = { forward: false, brake: false, turnLeft: false, turnRight: false, sailOpen: true, anchored: false };

  switch (ai.mode) {
    case 'approach': {
      // Sail toward target
      input.forward = true;
      const headingDiff = angleDiff(angleToTarget, ship.heading);
      if (headingDiff > 0.1) input.turnRight = true;
      else if (headingDiff < -0.1) input.turnLeft = true;

      // Switch to broadside when close enough
      if (dist < gunRange * 1.2) {
        ai.mode = 'broadside';
        ai.modeTimer = 3 + Math.random() * 2;
      }
      break;
    }

    case 'broadside': {
      // Try to get perpendicular to target (broadside position)
      const cross = fwd.x * dy - fwd.y * dx;
      const broadsideAngle = cross >= 0
        ? ship.heading + Math.PI / 2   // target is to starboard
        : ship.heading - Math.PI / 2;  // target is to port
      const desiredHeading = angleToTarget + (cross >= 0 ? -Math.PI / 2 : Math.PI / 2);
      const headingDiff = angleDiff(desiredHeading, ship.heading);

      if (headingDiff > 0.08) input.turnRight = true;
      else if (headingDiff < -0.08) input.turnLeft = true;

      // Row to maintain distance
      if (dist > gunRange * 0.8) input.forward = true;
      else if (dist < gunRange * 0.4) input.brake = true;

      // Auto-fire cannons toward target
      if (dist < cannonRange) {
        const side = cross >= 0 ? 'starboard' : 'port';
        fireCannonBroadside(ship, side, angleToTarget, spawnBullet);
      }

      // Return to approach if target moves away
      if (dist > cannonRange * 1.3 || ai.modeTimer <= 0) {
        ai.mode = 'approach';
      }
      break;
    }

    case 'unstick': {
      // Turn hard and row to get unstuck
      input.forward = true;
      input.turnRight = true;
      if (ai.modeTimer <= 0) {
        ai.mode = 'approach';
      }
      break;
    }

    default:
      ai.mode = 'approach';
  }

  ship._input = input;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Get all NPC ships as an array (for collision/combat iteration).
 */
export function getNpcShips(director) {
  const ships = [];
  for (const [id, npc] of director.npcs) {
    ships.push(npc.ship);
  }
  return ships;
}

/**
 * Get the doubloon reward for killing an NPC.
 */
export function getNpcReward(director, npcId) {
  const npc = director.npcs.get(npcId);
  return npc?.ship?._doubloonReward || NPC_BASE_DOUBLOON_REWARD;
}
