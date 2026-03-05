/**
 * NPC Director — spawns, manages AI, and scales difficulty for NPC enemy ships.
 * Server-side only.
 *
 * Archetypes: standard (aggressor), heavy (hunter), scavenger
 * AI personalities: aggressor (nearest player), hunter (richest player), scavenger (gold first)
 * Island avoidance: emergency flee + multi-probe tangent steering + persistent avoidance timer
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
    sailColor: '#e8dcc8',
    personality: 'aggressor'
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
    sailColor: '#c8b89a',
    personality: 'hunter'
  },
  scavenger: {
    name: 'Scavenger',
    speedMul: 1.15,
    extraGunners: 0,
    extraCannons: 0,
    hullColor: '#4a5a30',
    sailColor: '#c8d89a',
    personality: 'scavenger'
  }
};

const NPC_COLORWAYS = {
  standard: [
    { hull: '#5f4630', trim: '#d9b78d', sail: '#e8dcc8' },
    { hull: '#6a3f33', trim: '#d7b28a', sail: '#efe3cf' },
    { hull: '#4f4637', trim: '#b7c2ab', sail: '#d9decf' },
    { hull: '#5a3f4f', trim: '#d7b7d2', sail: '#eee2f2' }
  ],
  heavy: [
    { hull: '#4a3828', trim: '#c3a37e', sail: '#c8b89a' },
    { hull: '#433327', trim: '#aeb7c3', sail: '#c9d0d8' },
    { hull: '#3f3a49', trim: '#b8b3d1', sail: '#d9d3ea' },
    { hull: '#4a3a32', trim: '#d2b6a1', sail: '#d7c6b6' }
  ],
  scavenger: [
    { hull: '#4a5a30', trim: '#b9c98d', sail: '#c8d89a' },
    { hull: '#3e5b4d', trim: '#9fd1c0', sail: '#b8ddd0' },
    { hull: '#4e4f35', trim: '#c4c596', sail: '#d7d8bc' },
    { hull: '#3f565c', trim: '#a6c7d0', sail: '#c7e0e7' }
  ]
};

// ─── Helpers ───

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Multi-probe island avoidance.
 * Returns { avoid: true, turnLeft, turnRight, avoidDir } or { avoid: false }.
 */
function computeIslandAvoidance(ship, islands) {
  if (!islands || islands.length === 0) return { avoid: false };

  const EMERGENCY_PAD  = 30;   // already overlapping — steer away hard
  const PROBE_DIST     = Math.max(180, (ship.speed || 1) * 50);
  const AVOID_PAD      = 60;   // extra clearance around island radius
  const PROBE_ANGLES   = [0, 0.45, -0.45, 1.0, -1.0]; // relative to heading

  // Tier 1 — emergency: ship is already on or very near an island
  for (const isl of islands) {
    const d = Math.hypot(ship.x - isl.x, ship.y - isl.y);
    if (d < (isl.radius || 60) + EMERGENCY_PAD) {
      const escapeAngle = Math.atan2(ship.y - isl.y, ship.x - isl.x);
      const diff = angleDiff(escapeAngle, ship.heading);
      return {
        avoid: true,
        emergency: true,
        turnLeft:  diff < -0.08,
        turnRight: diff >  0.08,
        avoidDir:  diff >= 0 ? 1 : -1
      };
    }
  }

  // Tier 2 — predictive: cast probes and find worst threat
  let worstThreat = Infinity;
  let worstIsland = null;
  let worstProbeAngle = 0;

  for (const dAngle of PROBE_ANGLES) {
    const probeAngle = ship.heading + dAngle;
    const probeX = ship.x + Math.cos(probeAngle) * PROBE_DIST;
    const probeY = ship.y + Math.sin(probeAngle) * PROBE_DIST;

    for (const isl of islands) {
      const d = Math.hypot(probeX - isl.x, probeY - isl.y);
      const threshold = (isl.radius || 60) + AVOID_PAD;
      if (d < threshold && d < worstThreat) {
        worstThreat = d;
        worstIsland = isl;
        worstProbeAngle = dAngle;
      }
    }
  }

  if (!worstIsland) return { avoid: false };

  // Choose tangent direction: steer around the island rather than away from center
  // Tangent left = heading - PI/2 relative to island, tangent right = heading + PI/2
  const toIslandAngle = Math.atan2(worstIsland.y - ship.y, worstIsland.x - ship.x);
  const tangentLeft  = toIslandAngle - Math.PI / 2;
  const tangentRight = toIslandAngle + Math.PI / 2;
  // Pick whichever tangent is closer to current heading
  const diffLeft  = Math.abs(angleDiff(tangentLeft,  ship.heading));
  const diffRight = Math.abs(angleDiff(tangentRight, ship.heading));
  const useTangentLeft = diffLeft < diffRight;
  const avoidDir = useTangentLeft ? -1 : 1; // -1 = turn left, +1 = turn right

  return {
    avoid: true,
    emergency: false,
    turnLeft:  avoidDir < 0,
    turnRight: avoidDir > 0,
    avoidDir
  };
}

/**
 * Select combat/patrol target based on personality.
 * Returns the target ship, or null if scavenger is prioritising a drop.
 */
function selectTarget(ai, ship, playerShips, drops) {
  const alive = playerShips.filter(p => p && p.alive);
  if (alive.length === 0) return null;

  switch (ai.personality) {
    case 'hunter': {
      // Re-evaluate richest target every few seconds
      ai._hunterTimer = (ai._hunterTimer || 0) - 0.05; // called ~20Hz
      if (ai._hunterTimer <= 0 || !ai._hunterTargetId) {
        ai._hunterTimer = 3 + Math.random() * 2;
        let richest = alive[0];
        for (const p of alive) {
          if ((p.doubloons || 0) > (richest.doubloons || 0)) richest = p;
        }
        ai._hunterTargetId = richest.id;
      }
      const preferred = alive.find(p => p.id === ai._hunterTargetId);
      return preferred || alive[0];
    }

    case 'scavenger': {
      // Look for nearby gold drop first
      if (drops && drops.length > 0) {
        let closest = null;
        let closestDist = 600;
        for (const d of drops) {
          const dist = Math.hypot(d.x - ship.x, d.y - ship.y);
          if (dist < closestDist) {
            closestDist = dist;
            closest = d;
          }
        }
        if (closest) {
          ai.dropTarget = { x: closest.x, y: closest.y };
          return null; // handled separately
        }
      }
      ai.dropTarget = null;
      // Fall back to nearest player
      let nearest = alive[0];
      let nearestDist = Math.hypot(alive[0].x - ship.x, alive[0].y - ship.y);
      for (const p of alive) {
        const d = Math.hypot(p.x - ship.x, p.y - ship.y);
        if (d < nearestDist) { nearestDist = d; nearest = p; }
      }
      return nearest;
    }

    default: // 'aggressor' — nearest player
    {
      let nearest = alive[0];
      let nearestDist = Math.hypot(alive[0].x - ship.x, alive[0].y - ship.y);
      for (const p of alive) {
        const d = Math.hypot(p.x - ship.x, p.y - ship.y);
        if (d < nearestDist) { nearestDist = d; nearest = p; }
      }
      return nearest;
    }
  }
}

// ─── Director lifecycle ───

export function createNpcDirector() {
  return {
    npcs: new Map(),
    spawnTimer: 2.0,
    difficultyTimer: 0,
    currentUpgradeCount: 0
  };
}

export function spawnNpc(director, playerPositions, roundTime) {
  const id = nextNpcId++;

  // Archetype distribution: 50% standard, 25% heavy, 25% scavenger
  const roll = Math.random();
  const archetypeKey = roll < 0.50 ? 'standard' : roll < 0.75 ? 'heavy' : 'scavenger';
  const archetype = ARCHETYPE[archetypeKey];

  // Spawn at a random edge, preferring positions far from players
  const pickEdgePos = () => {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: return { x: WORLD_EDGE_PAD + 30,                y: WORLD_EDGE_PAD + Math.random() * (WORLD_HEIGHT - WORLD_EDGE_PAD * 2) };
      case 1: return { x: WORLD_WIDTH - WORLD_EDGE_PAD - 30,  y: WORLD_EDGE_PAD + Math.random() * (WORLD_HEIGHT - WORLD_EDGE_PAD * 2) };
      case 2: return { x: WORLD_EDGE_PAD + Math.random() * (WORLD_WIDTH - WORLD_EDGE_PAD * 2), y: WORLD_EDGE_PAD + 30 };
      default: return { x: WORLD_EDGE_PAD + Math.random() * (WORLD_WIDTH - WORLD_EDGE_PAD * 2), y: WORLD_HEIGHT - WORLD_EDGE_PAD - 30 };
    }
  };

  let { x, y } = pickEdgePos();
  if (playerPositions.length > 0) {
    let bestX = x, bestY = y, bestMinDist = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { x: cx, y: cy } = pickEdgePos();
      let minDist = Infinity;
      for (const p of playerPositions) {
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) { bestMinDist = minDist; bestX = cx; bestY = cy; }
    }
    x = bestX; y = bestY;
  }

  const ship = createShip(x, y, { id, name: archetype.name, isNpc: true });
  initStarterLoadout(ship);

  if (archetype.sizeMul) ship.size *= archetype.sizeMul;
  if (archetype.massMul) ship.mass *= archetype.massMul;
  if (archetype.hpMul)   { ship.maxHp *= archetype.hpMul; ship.hp = ship.maxHp; }
  ship.baseSpeed *= archetype.speedMul;
  if (archetype.extraGunners) { ship.gunners += archetype.extraGunners; ship.crew += archetype.extraGunners; }
  const colorways = NPC_COLORWAYS[archetypeKey] || NPC_COLORWAYS.standard;
  const colorway = colorways[Math.abs((id + director.currentUpgradeCount) % colorways.length)];
  ship.hullColor  = colorway?.hull || archetype.hullColor;
  ship.trimColor  = colorway?.trim || ship.trimColor;
  ship.sailColor  = colorway?.sail || archetype.sailColor;
  ship.invulnTimer = 0;

  const threat = Math.min(4, 1 + Math.floor(director.currentUpgradeCount / 2));
  const flagPalettes = [
    { flag: '#4f89c2', accent: '#b7d6f1' },
    { flag: '#d08a39', accent: '#f4d5a8' },
    { flag: '#b44d74', accent: '#f3bfd1' },
    { flag: '#4c9d5b', accent: '#b7e6be' }
  ];
  const pick = flagPalettes[(id + threat) % flagPalettes.length];
  ship.flagColor   = pick.flag;
  ship.flagAccent  = pick.accent;
  ship.flagStripes = threat;

  scaleNpcWithUpgrades(ship, director.currentUpgradeCount);
  ship._doubloonReward = NPC_BASE_DOUBLOON_REWARD + director.currentUpgradeCount * NPC_DOUBLOON_PER_UPGRADE + Math.floor(Math.random() * 3);

  const aiState = {
    personality:   archetype.personality,
    mode:          'approach',
    stuckTimer:    0,
    modeTimer:     0,
    lastX:         x,
    lastY:         y,
    avoidTimer:    0,
    avoidDir:      1,
    dropTarget:    null,
    _hunterTimer:  0,
    _hunterTargetId: null
  };

  director.npcs.set(id, { ship, aiState });
  return id;
}

export function removeNpc(director, npcId) {
  director.npcs.delete(npcId);
}

export function tickNpcDirector(director, playerShips, world, islands, drops, dt, roundTime, spawnBullet, events) {
  director.currentUpgradeCount = Math.floor(roundTime / 60);

  const spawnInterval = Math.max(1.5, NPC_SPAWN_INTERVAL_BASE - roundTime * 0.004);
  director.spawnTimer -= dt;
  if (director.spawnTimer <= 0 && director.npcs.size < MAX_NPCS && playerShips.length > 0) {
    director.spawnTimer = spawnInterval;
    const positions = playerShips.map(s => ({ x: s.x, y: s.y }));
    spawnNpc(director, positions, roundTime);
  }

  for (const [, npc] of director.npcs) {
    if (!npc.ship.alive) continue;
    tickNpcAi(npc, playerShips, world, islands, drops, dt, spawnBullet, events);
  }
}

// ─── NPC AI ───

function tickNpcAi(npc, playerShips, world, islands, drops, dt, spawnBullet, events) {
  const ship = npc.ship;
  const ai   = npc.aiState;

  const input = { forward: false, brake: false, turnLeft: false, turnRight: false, sailOpen: true, anchored: false };

  // ── Target selection (personality-based) ──
  const target = selectTarget(ai, ship, playerShips, drops);

  // ── Stuck detection ──
  const moved = Math.hypot(ship.x - ai.lastX, ship.y - ai.lastY);
  ai.lastX = ship.x; ai.lastY = ship.y;
  if (moved < 0.3 * dt * 60 && ship.speed < 0.3) {
    ai.stuckTimer += dt;
  } else {
    ai.stuckTimer = Math.max(0, ai.stuckTimer - dt * 2);
  }
  if (ai.stuckTimer > 1.8) {
    ai.mode = 'unstick';
    ai.modeTimer = 2.5;
    ai.unstickSign = Math.random() < 0.5 ? 1 : -1;
    ai.stuckTimer = 0;
  }

  ai.modeTimer = Math.max(0, (ai.modeTimer || 0) - dt);
  ai.avoidTimer = Math.max(0, (ai.avoidTimer || 0) - dt);

  // ── Scavenger: steer toward drop ──
  if (ai.dropTarget) {
    const dtx = ai.dropTarget.x - ship.x;
    const dty = ai.dropTarget.y - ship.y;
    const dropDist = Math.hypot(dtx, dty);
    if (dropDist < 60) {
      ai.dropTarget = null; // arrived
    } else {
      input.forward = true;
      const hdiff = angleDiff(Math.atan2(dty, dtx), ship.heading);
      if (hdiff > 0.1) input.turnRight = true;
      else if (hdiff < -0.1) input.turnLeft = true;
      // Opportunistic broadside fire during gold run
      _tryFireAtNearest(ship, playerShips, input, spawnBullet, events);
    }
  } else if (!target) {
    // No target, no drop — wander
    input.forward = true;
  } else {
    // ── Combat state machine ──
    const dx = target.x - ship.x;
    const dy = target.y - ship.y;
    const dist = Math.hypot(dx, dy);
    const angleToTarget = Math.atan2(dy, dx);
    const fwd = forwardVector(ship.heading);
    const gunRange    = getGunRange(ship);
    const cannonRange = getCannonRange(ship);

    if (ai.mode !== 'unstick' && dist < gunRange * 1.2 && ai.mode !== 'broadside') {
      ai.mode = 'broadside';
      ai.modeTimer = 3 + Math.random() * 2;
    }

    switch (ai.mode) {
      case 'approach': {
        input.forward = true;
        const hdiff = angleDiff(angleToTarget, ship.heading);
        if (hdiff > 0.1) input.turnRight = true;
        else if (hdiff < -0.1) input.turnLeft = true;
        break;
      }

      case 'broadside': {
        const cross = fwd.x * dy - fwd.y * dx;
        const desiredHeading = angleToTarget + (cross >= 0 ? -Math.PI / 2 : Math.PI / 2);
        const hdiff = angleDiff(desiredHeading, ship.heading);
        if (hdiff > 0.08) input.turnRight = true;
        else if (hdiff < -0.08) input.turnLeft = true;
        if (dist > gunRange * 0.8) input.forward = true;
        else if (dist < gunRange * 0.4) input.brake = true;

        if (dist < cannonRange) {
          const side = cross >= 0 ? 'starboard' : 'port';
          const didFire = fireCannonBroadside(ship, side, angleToTarget, spawnBullet);
          if (didFire && events) {
            const perpSign = side === 'starboard' ? 1 : -1;
            events.push({ type: 'cannonFire', id: ship.id, x: ship.x, y: ship.y,
              dx: -Math.sin(ship.heading) * perpSign, dy: Math.cos(ship.heading) * perpSign,
              count: 1, size: ship.size, side });
          }
        }
        if (dist > cannonRange * 1.3 || ai.modeTimer <= 0) {
          ai.mode = 'approach';
        }
        break;
      }

      case 'unstick': {
        input.forward = true;
        if (ai.unstickSign >= 0) input.turnRight = true;
        else input.turnLeft = true;
        if (ai.modeTimer <= 0) ai.mode = 'approach';
        break;
      }

      default:
        ai.mode = 'approach';
    }
  }

  // ── Island avoidance (always runs, overrides combat steering) ──
  const avoid = computeIslandAvoidance(ship, islands);
  if (avoid.avoid) {
    if (ai.avoidTimer <= 0) {
      // New avoidance event — lock in direction
      ai.avoidDir   = avoid.avoidDir;
      ai.avoidTimer = avoid.emergency ? 0.5 : 1.1;
    }
    // Apply avoidance — tangent steer in locked direction
    input.turnLeft  = ai.avoidDir < 0;
    input.turnRight = ai.avoidDir > 0;
    input.forward   = true;
    input.brake     = false;
    if (ai.mode === 'unstick') ai.mode = 'approach';
  } else if (ai.avoidTimer > 0) {
    // Persistent avoidance: keep turning same way for a bit after obstacle clears
    input.turnLeft  = ai.avoidDir < 0;
    input.turnRight = ai.avoidDir > 0;
    input.forward   = true;
  }

  ship._input = input;
}

// Fire cannons at nearest player opportunistically (used during scavenger gold run)
function _tryFireAtNearest(ship, playerShips, input, spawnBullet, events) {
  const fwd = forwardVector(ship.heading);
  let nearest = null; let nearestDist = Infinity;
  for (const p of playerShips) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - ship.x, p.y - ship.y);
    if (d < nearestDist) { nearestDist = d; nearest = p; }
  }
  if (!nearest) return;
  const cannonRange = getCannonRange(ship);
  if (nearestDist > cannonRange) return;
  const dx = nearest.x - ship.x; const dy = nearest.y - ship.y;
  const cross = fwd.x * dy - fwd.y * dx;
  const side = cross >= 0 ? 'starboard' : 'port';
  const didFire = fireCannonBroadside(ship, side, Math.atan2(dy, dx), spawnBullet);
  if (didFire && events) {
    const perpSign = side === 'starboard' ? 1 : -1;
    events.push({ type: 'cannonFire', id: ship.id, x: ship.x, y: ship.y,
      dx: -Math.sin(ship.heading) * perpSign, dy: Math.cos(ship.heading) * perpSign,
      count: 1, size: ship.size, side });
  }
}

export function getNpcShips(director) {
  const ships = [];
  for (const [, npc] of director.npcs) ships.push(npc.ship);
  return ships;
}

export function getNpcReward(director, npcId) {
  const npc = director.npcs.get(npcId);
  return npc?.ship?._doubloonReward || NPC_BASE_DOUBLOON_REWARD;
}
