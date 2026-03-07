/**
 * Main game simulation — orchestrates all directors and shared systems.
 * Server-side only. Authoritative game state.
 *
 * Architecture:
 *   simulation.js  →  shared/physics.js      (movement, collisions)
 *                  →  shared/combat.js        (broadside, bullets, damage, fire)
 *                  →  shared/shipState.js     (ship factory, derived stats)
 *                  →  server/upgradeDirector  (XP, levels, upgrade offers)
 *                  →  server/npcDirector      (NPC spawning, AI, difficulty)
 *                  →  server/worldManager     (islands, buildings, towers)
 */

import { createShip, shipSnapshot } from '../shared/shipState.js';
import { stepShipPhysics, forwardVector, resolveShipCollision, rollWindVector } from '../shared/physics.js';
import { tickGunAutoFire, fireCannonBroadside, tickBullets, applyDamage, tickFire, tickRepair } from '../shared/combat.js';
import { createNpcDirector, tickNpcDirector, getNpcShips, getNpcReward, removeNpc } from './npcDirector.js';
import { createWorldState, damageBuildingAtPoint, tickTowers, applyIslandContact, updateDefenseTier, getWorldSnapshot } from './worldManager.js';
import { loadCatalog, initStarterLoadout, initStartingUpgradeOffer, awardXp, selectUpgrade } from './upgradeDirector.js';
import { createRoundVoteState, normalizeRoundCatalog, removeRoundVotesForPlayer, resolveRoundConfig, submitRoundVote as submitVoteSelection } from '../shared/roundConfig.js';
import { clamp } from '../src/core/math.js';
import {
  TICK_RATE, TICK_INTERVAL, ROUND_DURATION,
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_EDGE_PAD,
  WIND_SHIFT_INTERVAL,
  DOUBLOON_DROP_RATIO, RESPAWN_INVULN,
  DOUBLOON_PICKUP_RADIUS, DOUBLOON_MAGNET_RADIUS, DOUBLOON_MAGNET_SPEED,
  DOUBLOON_TIMEOUT, PASSIVE_DOUBLOON_RATE
} from '../shared/constants.js';

export { TICK_RATE, TICK_INTERVAL };

// ─── Spawn points ───
function buildSpawnCorners(worldWidth, worldHeight) {
  const edgeInsetX = Math.max(140, Math.min(200, Math.round(worldWidth * 0.07)));
  const edgeInsetY = Math.max(140, Math.min(200, Math.round(worldHeight * 0.09)));
  const quarterX = Math.round(worldWidth * 0.25);
  const midX = Math.round(worldWidth * 0.5);
  const threeQuarterX = Math.round(worldWidth * 0.75);
  const quarterY = Math.round(worldHeight * 0.3);
  const midY = Math.round(worldHeight * 0.5);
  const threeQuarterY = Math.round(worldHeight * 0.7);

  return [
    { x: edgeInsetX, y: edgeInsetY },
    { x: worldWidth - edgeInsetX, y: edgeInsetY },
    { x: edgeInsetX, y: worldHeight - edgeInsetY },
    { x: worldWidth - edgeInsetX, y: worldHeight - edgeInsetY },
    { x: midX, y: edgeInsetY },
    { x: midX, y: worldHeight - edgeInsetY },
    { x: edgeInsetX, y: midY },
    { x: worldWidth - edgeInsetX, y: midY },
    { x: quarterX, y: quarterY },
    { x: threeQuarterX, y: threeQuarterY }
  ];
}

function getSpawnCorners(sim) {
  return buildSpawnCorners(sim.world.width, sim.world.height);
}

function getResultsDuration(sim) {
  return sim.roundCatalog?.resultsDuration || 20;
}

function roundToThousandths(value) {
  return Math.round(value * 1000) / 1000;
}

export function calculateRoundPlayerScore(playerKills, deaths, doubloons) {
  const safeKills = Math.max(0, Number(playerKills) || 0);
  const safeDeaths = Math.max(0, Number(deaths) || 0);
  const safeDoubloons = Math.max(0, Math.floor(Number(doubloons) || 0));
  const completionBonus = safeDoubloons * 0.1;
  const kdRatio = safeDeaths > 0 ? (safeKills / safeDeaths) : NaN;
  const pvpBonus = Number.isFinite(kdRatio) && kdRatio > 0 ? (kdRatio * safeDoubloons) : 0;

  return roundToThousandths(completionBonus + pvpBonus);
}

// ─── Simulation factory ───

export async function createSimulation(roundCatalogData = null) {
  // Load upgrade catalog before anything else
  await loadCatalog();

  const seed = Date.now();
  const roundCatalog = normalizeRoundCatalog(roundCatalogData || {});
  const roundVoteState = createRoundVoteState(roundCatalog, false);
  const roundConfig = resolveRoundConfig(roundCatalog, roundVoteState);

  return {
    time: 0,
    roundTimer: ROUND_DURATION,
    roundPhase: 'playing',
    resultsTimer: 0,
    roundCatalog,
    roundVoteState,
    roundConfig,
    world: { width: roundConfig.worldWidth, height: roundConfig.worldHeight },
    wind: { x: 0.42, y: -0.14, timer: 0 },
    players: new Map(),           // playerId → { ship, input }
    bullets: [],
    drops: [],                    // { x, y, value, vx, vy, age }
    nextPlayerId: 1,
    nextBulletId: 1,
    events: [],                   // per-tick events for clients

    // Directors
    npcDirector: createNpcDirector(),
    worldState: createWorldState(seed, roundConfig),

    // Round summary / persistence hooks
    roundSummary: null,
    persistentLeaderboard: [],
    onRoundEnded: null,
    activePlayerLimit: 10,

    // Round seed (for client world gen sync)
    roundSeed: seed
  };
}

// ─── Player management ───

export function addPlayer(sim, name) {
  const id = sim.nextPlayerId++;
  const spawnCorners = getSpawnCorners(sim);
  const spawn = spawnCorners[(sim.players.size) % spawnCorners.length];
  const ship = createShip(spawn.x, spawn.y, { id, name: name || `Player ${id}` });

  // Apply starter loadout
  initStarterLoadout(ship);

  // Roll the first starting upgrade offer (player will pick 3 before playing)
  initStartingUpgradeOffer(ship);

  sim.players.set(id, {
    ship,
    spectator: false,
    input: { forward: false, brake: false, turnLeft: false, turnRight: false, sailOpen: true, anchored: false }
  });
  return id;
}

export function removePlayer(sim, id) {
  sim.players.delete(id);
  sim.roundVoteState = removeRoundVotesForPlayer(sim.roundCatalog, sim.roundVoteState, id);
}

export function submitRoundVote(sim, playerId, categoryId, choiceId) {
  if (sim.roundPhase !== 'results') return false;
  if (!sim.players.has(playerId)) return false;
  sim.roundVoteState = submitVoteSelection(sim.roundCatalog, sim.roundVoteState, playerId, categoryId, choiceId);
  return true;
}

export function setPlayerInput(sim, id, input) {
  const pd = sim.players.get(id);
  if (!pd || pd.spectator) return;
  if (input.forward !== undefined) pd.input.forward = !!input.forward;
  if (input.brake !== undefined) pd.input.brake = !!input.brake;
  if (input.turnLeft !== undefined) pd.input.turnLeft = !!input.turnLeft;
  if (input.turnRight !== undefined) pd.input.turnRight = !!input.turnRight;
  if (input.sailOpen !== undefined) pd.input.sailOpen = !!input.sailOpen;
  if (input.anchored !== undefined) pd.input.anchored = !!input.anchored;
}

/**
 * Handle cannon fire request from a player (click-to-aim).
 */
export function playerFireCannon(sim, playerId, aimAngle) {
  const pd = sim.players.get(playerId);
  if (!pd || pd.spectator || !pd.ship.alive) return;

  const ship = pd.ship;
  const fwd = forwardVector(ship.heading);
  const dx = Math.cos(aimAngle) - fwd.x;
  const dy = Math.sin(aimAngle) - fwd.y;
  const cross = fwd.x * Math.sin(aimAngle) - fwd.y * Math.cos(aimAngle);
  const side = cross >= 0 ? 'starboard' : 'port';

  const volleyBullets = [];
  const fired = fireCannonBroadside(ship, side, aimAngle, (bullet) => {
    bullet.id = sim.nextBulletId++;
    sim.bullets.push(bullet);
    if (bullet.heavy) volleyBullets.push(bullet);
  });

  if (fired) {
    const perpSign = side === 'starboard' ? 1 : -1;
    if (volleyBullets.length > 0) {
      for (let i = 0; i < volleyBullets.length; i++) {
        const b = volleyBullets[i];
        sim.events.push({
          type: 'cannonFire',
          id: playerId,
          x: b.x,
          y: b.y,
          dx: b.vx,
          dy: b.vy,
          count: volleyBullets.length,
          size: ship.size,
          side,
          playSfx: i === 0
        });
      }
    } else {
      sim.events.push({
        type: 'cannonFire',
        id: playerId,
        x: ship.x,
        y: ship.y,
        dx: -Math.sin(ship.heading) * perpSign,
        dy: Math.cos(ship.heading) * perpSign,
        count: fired === true ? 1 : (fired || 1),
        size: ship.size,
        side,
        playSfx: true
      });
    }
  }
}

/**
 * Handle upgrade selection from a player.
 */
export function playerSelectUpgrade(sim, playerId, choiceIndex) {
  const pd = sim.players.get(playerId);
  if (!pd || pd.spectator) return null;
  return selectUpgrade(pd.ship, choiceIndex);
}

// ─── Main tick ───

export function tick(sim) {
  const dt = TICK_INTERVAL;
  if (sim.roundPhase !== 'playing') {
    tickIntermission(sim, dt);
    return;
  }

  sim.time += dt;
  sim.roundTimer -= dt;

  // Wind
  sim.wind.timer += dt;
  if (sim.wind.timer >= WIND_SHIFT_INTERVAL) {
    sim.wind.timer = 0;
    const nextWind = rollWindVector();
    sim.wind.x = nextWind.x;
    sim.wind.y = nextWind.y;
  }

  // Gather all ships for combat/collision
  const allPlayerShips = [];
  const allShips = [];   // { ship, id }

  // ─── Player physics ───
  for (const [id, pd] of sim.players) {
    if (pd.spectator) continue;
    if (!pd.ship.alive) continue;
    const ship = pd.ship;

    stepShipPhysics(ship, pd.input, sim.wind, sim.world, dt);
    tickRepair(ship, dt);
    tickFire(ship, dt);

    // Island contact
    const islandDmg = applyIslandContact(ship, sim.worldState, dt);
    if (islandDmg > 0) {
      const died = applyDamage(ship, islandDmg, false);
      if (died) handleDeath(sim, id, ship, -1);
    }

    allPlayerShips.push(ship);
    allShips.push({ ship, id });
  }

  // ─── NPC tick ───
  tickNpcDirector(sim.npcDirector, allPlayerShips, sim.world, sim.worldState.islands, sim.drops, dt, ROUND_DURATION - sim.roundTimer, (bullet) => {
    bullet.id = sim.nextBulletId++;
    sim.bullets.push(bullet);
  }, sim.events, sim.roundConfig);

  // NPC physics + fire
  for (const [npcId, npc] of sim.npcDirector.npcs) {
    if (!npc.ship.alive) continue;
    const ship = npc.ship;
    const input = ship._input || { forward: false, brake: false, turnLeft: false, turnRight: false, sailOpen: true, anchored: false };

    stepShipPhysics(ship, input, sim.wind, sim.world, dt);
    tickRepair(ship, dt);

    const fireDied = tickFire(ship, dt);
    if (fireDied) {
      handleNpcDeath(sim, npcId, npc.ship, -1);
      continue;
    }

    // Island contact for NPCs
    const islandDmg = applyIslandContact(ship, sim.worldState, dt);
    if (islandDmg > 0) {
      const died = applyDamage(ship, islandDmg, false);
      if (died) { handleNpcDeath(sim, npcId, ship, -1); continue; }
    }

    allShips.push({ ship, id: npcId });
  }

  // ─── Gun auto-fire for all ships ───
  for (const entry of allShips) {
    const targets = allShips.filter(t => t.id !== entry.id);
    let gunFiredCount = 0;
    let gfDx = 0, gfDy = 0;
    tickGunAutoFire(entry.ship, targets, dt, (bullet) => {
      bullet.id = sim.nextBulletId++;
      sim.bullets.push(bullet);
      gunFiredCount++;
      gfDx = bullet.vx;
      gfDy = bullet.vy;
    });
    if (gunFiredCount > 0) {
      sim.events.push({
        type: 'gunFire',
        x: entry.ship.x, y: entry.ship.y,
        dx: gfDx, dy: gfDy,
        count: gunFiredCount,
        size: entry.ship.size
      });
    }
  }

  // ─── Bullet update + hit detection ───
  tickBullets(sim.bullets, allShips, sim.world, dt, (bullet, victimShip, dmg) => {
    const died = applyDamage(victimShip, dmg, bullet.heavy);

    // Building damage (bullets that miss ships can hit buildings)
    // Actually, buildings are checked separately below

    if (died) {
      if (victimShip.isNpc) {
        handleNpcDeath(sim, victimShip.id, victimShip, bullet.ownerId);
      } else {
        handleDeath(sim, victimShip.id, victimShip, bullet.ownerId);
      }
    }

    // Fire event for client effects
    sim.events.push({
      type: 'hit',
      x: bullet.x,
      y: bullet.y,
      heavy: bullet.heavy,
      dx: bullet.vx,
      dy: bullet.vy,
      size: victimShip.size,
      victimId: victimShip.id
    });
  });

  // ─── Building damage from bullets that went out of range ───
  // Check remaining bullets against buildings
  for (let i = sim.bullets.length - 1; i >= 0; i--) {
    const b = sim.bullets[i];
    if (b.ownerId === -1) continue;
    const buildingDrops = damageBuildingAtPoint(sim.worldState, b.x, b.y, b.dmg, b.heavy, b.prevX, b.prevY);
    if (buildingDrops.length > 0) {
      sim.drops.push(...buildingDrops);
      sim.bullets.splice(i, 1);

      sim.events.push({
        type: 'buildingHit',
        x: b.x,
        y: b.y
      });
    }
  }

  // ─── Tower firing ───
  const roundTime = ROUND_DURATION - sim.roundTimer;
  const defenseLevel = Math.floor(roundTime / 90);
  updateDefenseTier(sim.worldState, roundTime);
  tickTowers(sim.worldState, allPlayerShips, defenseLevel, dt, (bullet) => {
    bullet.id = sim.nextBulletId++;
    sim.bullets.push(bullet);
  });

  // ─── Ship-to-ship collisions ───
  for (let i = 0; i < allShips.length; i++) {
    for (let j = i + 1; j < allShips.length; j++) {
      const a = allShips[i].ship;
      const b = allShips[j].ship;
      if (!a.alive || !b.alive) continue;

      const result = resolveShipCollision(a, b, sim.world);
      if (!result) continue;

      // Apply impact damage (respecting invulnerability)
      if (result.impactA > 0 && (a.invulnTimer || 0) <= 0) {
        const died = applyDamage(a, result.impactA, false);
        if (died) {
          if (a.isNpc) handleNpcDeath(sim, a.id, a, b.id);
          else handleDeath(sim, a.id, a, b.id);
        }
      }
      if (result.impactB > 0 && (b.invulnTimer || 0) <= 0) {
        const died = applyDamage(b, result.impactB, false);
        if (died) {
          if (b.isNpc) handleNpcDeath(sim, b.id, b, a.id);
          else handleDeath(sim, b.id, b, a.id);
        }
      }
    }
  }

  // ─── Doubloon drops (players + NPCs can collect) ───
  const dropCollectors = [...allPlayerShips];
  for (const [, npc] of sim.npcDirector.npcs) {
    if (npc.ship?.alive) dropCollectors.push(npc.ship);
  }
  tickDrops(sim, dropCollectors, dt);

  // ─── Passive doubloons + XP ───
  for (const [id, pd] of sim.players) {
    if (pd.spectator) continue;
    if (!pd.ship.alive) continue;
    const passiveGain = dt * PASSIVE_DOUBLOON_RATE;
    pd.ship.doubloons += passiveGain;
    const offer = awardXp(pd.ship, passiveGain);
    if (offer) {
      sim.events.push({ type: 'upgradeOffer', playerId: id, offer });
    }
  }

  // ─── Round end ───
  if (sim.roundTimer <= 0) {
    startRoundResults(sim);
  }
}

function tickIntermission(sim, dt) {
  sim.time += dt;
  sim.resultsTimer -= dt;
  if (sim.resultsTimer <= 0) {
    resetRound(sim);
  }
}

function startRoundResults(sim) {
  if (sim.roundPhase !== 'playing') return;
  sim.roundTimer = 0;
  sim.roundPhase = 'results';
  sim.roundVoteState = createRoundVoteState(sim.roundCatalog, true);
  sim.resultsTimer = getResultsDuration(sim);
  sim.roundSummary = buildRoundSummary(sim);

  if (typeof sim.onRoundEnded === 'function') {
    const nextLeaderboard = sim.onRoundEnded(sim.roundSummary);
    if (Array.isArray(nextLeaderboard)) {
      sim.persistentLeaderboard = nextLeaderboard;
    }
  }

  sim.events.push({
    type: 'roundEnded',
    duration: getResultsDuration(sim),
    summary: sim.roundSummary,
    persistentLeaderboard: sim.persistentLeaderboard,
    roundVoteState: sim.roundVoteState
  });
}

function buildRoundSummary(sim) {
  const players = [];

  for (const [id, pd] of sim.players) {
    const ship = pd.ship;
    const playerKills = ship.playerKills || 0;
    const deaths = ship.deaths || 0;
    const doubloons = Math.floor(ship.doubloons || 0);
    const score = calculateRoundPlayerScore(playerKills, deaths, doubloons);
    players.push({
      id,
      name: ship.name || `Player ${id}`,
      playerKills,
      kills: ship.kills || 0,
      deaths,
      doubloons,
      score,
      level: ship.level || 1
    });
  }

  players.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.doubloons !== a.doubloons) return b.doubloons - a.doubloons;
    return b.playerKills - a.playerKills;
  });

  return {
    endedAt: Date.now(),
    players
  };
}

// ─── Death handling ───

function handleDeath(sim, victimId, victimShip, killerId) {
  victimShip.deaths += 1;
  victimShip.alive = false;
  victimShip.onFire = false;

  // Credit killer
  let killerName = '???';
  if (killerId > 0) {
    const killerPd = sim.players.get(killerId);
    if (killerPd) {
      killerPd.ship.kills += 1;
      killerPd.ship.playerKills = (killerPd.ship.playerKills || 0) + 1;
      killerName = killerPd.ship.name;
    }
    // Check NPC killer
    const npc = sim.npcDirector.npcs.get(killerId);
    if (npc) killerName = npc.ship.name;
  }

  // Drop 20% doubloons
  const dropAmount = Math.floor(victimShip.doubloons * DOUBLOON_DROP_RATIO);
  if (dropAmount > 0) {
    victimShip.doubloons -= dropAmount;
    scatterDrops(sim, victimShip.x, victimShip.y, dropAmount);
  }

  // Event
  sim.events.push({
    type: 'kill',
    killer: killerId,
    killerName,
    victim: victimId,
    victimName: victimShip.name
  });

  // Ship explosion (players respawn, so show the bang before respawn sets alive=true)
  sim.events.push({
    type: 'explosion',
    x: victimShip.x,
    y: victimShip.y,
    size: victimShip.size,
    hullColor: victimShip.hullColor,
    trimColor: victimShip.trimColor
  });

  // Immediate respawn
  respawnShip(sim, victimShip);
}

function handleNpcDeath(sim, npcId, npcShip, killerId) {
  npcShip.alive = false;
  npcShip.onFire = false;

  // Reward killer with doubloons + XP
  const reward = getNpcReward(sim.npcDirector, npcId);
  let killerName = '???';

  if (killerId > 0) {
    const killerPd = sim.players.get(killerId);
    if (killerPd) {
      killerPd.ship.kills += 1;
      killerPd.ship.doubloons += reward;
      killerName = killerPd.ship.name;

      // XP from kill
      const offer = awardXp(killerPd.ship, reward);
      if (offer) {
        sim.events.push({
          type: 'upgradeOffer',
          playerId: killerId,
          offer
        });
      }
    }
  }

  // Scatter NPC's doubloons as loot
  if (reward > 1) {
    scatterDrops(sim, npcShip.x, npcShip.y, Math.ceil(reward * 0.6));
  }

  // Event
  sim.events.push({
    type: 'kill',
    killer: killerId,
    killerName,
    victim: npcId,
    victimName: npcShip.name
  });

  // Ship explosion event
  sim.events.push({
    type: 'explosion',
    x: npcShip.x,
    y: npcShip.y,
    size: npcShip.size,
    hullColor: npcShip.hullColor,
    trimColor: npcShip.trimColor
  });

  // Remove NPC
  removeNpc(sim.npcDirector, npcId);
}

function scatterDrops(sim, x, y, totalValue) {
  const numDrops = clamp(Math.ceil(totalValue / 5), 3, 20);
  const perDrop = totalValue / numDrops;
  for (let i = 0; i < numDrops; i++) {
    const angle = (Math.PI * 2 * i) / numDrops + Math.random() * 0.4;
    const dist = 20 + Math.random() * 40;
    sim.drops.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      value: Math.round(perDrop),
      vx: Math.cos(angle) * (0.8 + Math.random() * 0.6),
      vy: Math.sin(angle) * (0.8 + Math.random() * 0.6),
      age: 0
    });
  }
}

function respawnShip(sim, ship) {
  const spawnCorners = getSpawnCorners(sim);
  const respawnInsetX = Math.max(140, Math.min(180, Math.round(sim.world.width * 0.06)));
  const respawnInsetY = Math.max(140, Math.min(180, Math.round(sim.world.height * 0.08)));
  const searchStepX = Math.max(260, Math.round((sim.world.width - respawnInsetX * 2) / 6));
  const searchStepY = Math.max(240, Math.round((sim.world.height - respawnInsetY * 2) / 5));
  const jitterRadius = Math.max(160, Math.min(240, Math.round(Math.min(sim.world.width, sim.world.height) * 0.08)));

  // Find position farthest from all living entities
  let bestPos = spawnCorners[0];
  let bestMinDist = 0;

  for (let x = respawnInsetX; x < sim.world.width - respawnInsetX; x += searchStepX) {
    for (let y = respawnInsetY; y < sim.world.height - respawnInsetY; y += searchStepY) {
      let minDist = Infinity;
      for (const [, pd] of sim.players) {
        if (!pd.ship.alive || pd.ship.id === ship.id) continue;
        const dx = pd.ship.x - x;
        const dy = pd.ship.y - y;
        minDist = Math.min(minDist, dx * dx + dy * dy);
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestPos = { x, y };
      }
    }
  }

  ship.x = clamp(bestPos.x + (Math.random() - 0.5) * jitterRadius, respawnInsetX, sim.world.width - respawnInsetX);
  ship.y = clamp(bestPos.y + (Math.random() - 0.5) * jitterRadius, respawnInsetY, sim.world.height - respawnInsetY);
  ship.heading = Math.random() * Math.PI * 2;
  ship.speed = 0;
  ship.hp = ship.maxHp;
  ship.repairSuppressed = 0;
  ship.impactTimer = 0;
  ship.invulnTimer = RESPAWN_INVULN;
  ship.gunTimer = 0;
  ship.cannonTimer = 0;
  ship.gunMountTimers = { port: [], starboard: [] };
  ship.cannonMountTimers = { port: [], starboard: [] };
  ship.onFire = false;
  ship.fireTimer = 0;
  ship.fireTicks = 0;
  ship.alive = true;
}

// ─── Doubloon drops ───

function tickDrops(sim, playerShips, dt) {
  for (let i = sim.drops.length - 1; i >= 0; i--) {
    const drop = sim.drops[i];
    drop.age = (drop.age || 0) + dt;

    // Scatter velocity decay
    drop.vx *= 0.92;
    drop.vy *= 0.92;
    drop.x += drop.vx * dt * 30;
    drop.y += drop.vy * dt * 30;
    drop.x = clamp(drop.x, 4, sim.world.width - 4);
    drop.y = clamp(drop.y, 4, sim.world.height - 4);

    // Magnet + pickup
    let collected = false;
    for (const ship of playerShips) {
      if (!ship.alive) continue;
      const dx = ship.x - drop.x;
      const dy = ship.y - drop.y;
      const d = Math.hypot(dx, dy);

      if (d < DOUBLOON_PICKUP_RADIUS) {
        ship.doubloons += drop.value;
        collected = true;

        // XP from gold pickup
        const offer = awardXp(ship, drop.value);
        if (offer) {
          sim.events.push({
            type: 'upgradeOffer',
            playerId: ship.id,
            offer
          });
        }
        break;
      } else if (d < DOUBLOON_MAGNET_RADIUS && drop.age > 0.3) {
        const pull = DOUBLOON_MAGNET_SPEED * dt * 60 / Math.max(1, d);
        drop.x += dx * pull;
        drop.y += dy * pull;
      }
    }

    if (collected || drop.age > DOUBLOON_TIMEOUT) {
      sim.drops.splice(i, 1);
    }
  }
}

// ─── Round reset ───

export function resetRound(sim) {
  const seed = Date.now();
  const nextRoundConfig = resolveRoundConfig(sim.roundCatalog, sim.roundVoteState);
  sim.time = 0;
  sim.roundTimer = ROUND_DURATION;
  sim.roundPhase = 'playing';
  sim.resultsTimer = 0;
  sim.roundSummary = null;
  sim.wind = { x: 0.42, y: -0.14, timer: 0 };
  sim.bullets = [];
  sim.drops = [];
  sim.roundSeed = seed;
  sim.roundConfig = nextRoundConfig;
  sim.roundVoteState = createRoundVoteState(sim.roundCatalog, false);
  sim.world = { width: nextRoundConfig.worldWidth, height: nextRoundConfig.worldHeight };
  sim.worldState = createWorldState(seed, nextRoundConfig);
  sim.npcDirector = createNpcDirector();
  const spawnCorners = getSpawnCorners(sim);

  let idx = 0;
  for (const [, pd] of sim.players) {
    const spawn = spawnCorners[idx % spawnCorners.length];
    const ship = pd.ship;
    ship.x = spawn.x;
    ship.y = spawn.y;
    ship.heading = -Math.PI / 2;
    ship.speed = 0;
    ship.hp = ship.maxHp;
    ship.repairSuppressed = 0;
    ship.impactTimer = 0;
    ship.invulnTimer = RESPAWN_INVULN;
    ship.gunTimer = 0;
    ship.cannonTimer = 0;
    ship.cannonVolleyTimer = 0;
    ship.gunMountTimers = { port: [], starboard: [] };
    ship.cannonMountTimers = { port: [], starboard: [] };
    ship.onFire = false;
    ship.fireTimer = 0;
    ship.fireTicks = 0;
    ship.doubloons = 0;
    ship.kills = 0;
    ship.playerKills = 0;
    ship.deaths = 0;
    ship.level = 1;
    ship.xp = 0;
    ship.xpToNext = 10;
    ship.upgrades = [];
    ship.slots = [];
    ship.upgradeOffer = null;
    ship.pendingLevelUpOffers = 0;
    ship.pendingMajorOffers = 0;
    ship.startingPicksRemaining = 0;
    ship.alive = true;

    // Reset ship to starter baseline
    ship.size = 16;
    ship.mass = 28;
    ship.baseSpeed = 2.6;
    ship.maxHp = 20;
    ship.hp = 20;
    ship.gunReload = 1.35;
    ship.cannonReload = 3.4;
    ship.bulletDamage = 9;
    ship.rudder = 0;
    ship.maneuverPenalty = 0;
    ship.hullLength = 1;
    ship.hullBeam = 1;
    ship.bowSharpness = 1;
    ship.sternTaper = 1;
    ship.hullColor = '#5f4630';
    ship.trimColor = '#d9b78d';
    ship.sailColor = '#f0f7ff';
    ship.mastScale = 1;
    ship.hullArmorTier = 0;
    ship.ram = false;
    ship.ramDamage = 46;
    ship.lookoutRangeBonus = 0;
    ship.cannonCapacityBonus = 0;
    ship.cannonPivot = 0;

    // Re-apply starter loadout
    initStarterLoadout(ship);

    idx++;
  }

  sim.events.push({ type: 'roundReset', seed, roundConfig: sim.roundConfig });
}

// ─── State snapshot ───

export function getStateSnapshot(sim) {
  const players = {};
  const playerRoster = [];
  let activePlayerCount = 0;
  for (const [id, pd] of sim.players) {
    playerRoster.push({
      id,
      name: pd?.ship?.name || `Player ${id}`,
      spectator: !!pd?.spectator,
      alive: !!pd?.ship?.alive
    });
    if (pd.spectator) continue;
    activePlayerCount++;
    players[id] = shipSnapshot(pd.ship);
  }

  // NPC ships
  const npcs = {};
  for (const [id, npc] of sim.npcDirector.npcs) {
    if (npc.ship.alive) {
      npcs[id] = shipSnapshot(npc.ship);
    }
  }

  const bullets = sim.bullets.map(b => ({
    id: b.id,
    x: Math.round(b.x * 10) / 10,
    y: Math.round(b.y * 10) / 10,
    vx: Math.round(b.vx * 100) / 100,
    vy: Math.round(b.vy * 100) / 100,
    heavy: b.heavy,
    ownerId: b.ownerId
  }));

  const drops = sim.drops.map(d => ({
    x: Math.round(d.x * 10) / 10,
    y: Math.round(d.y * 10) / 10,
    value: d.value
  }));

  const snapshot = {
    type: 'state',
    time: Math.round(sim.time * 100) / 100,
    roundPhase: sim.roundPhase,
    phaseTimer: Math.max(0, Math.round(sim.resultsTimer * 10) / 10),
    roundTimer: Math.round(sim.roundTimer * 10) / 10,
    wind: { x: Math.round(sim.wind.x * 1000) / 1000, y: Math.round(sim.wind.y * 1000) / 1000 },
    world: sim.world,
    roundConfig: sim.roundConfig,
    roundVoteState: sim.roundVoteState,
    roundSeed: sim.roundSeed,
    roundSummary: sim.roundSummary,
    persistentLeaderboard: sim.persistentLeaderboard,
    lobbyPlayerCount: sim.players.size,
    activePlayerCount,
    spectatorCount: Math.max(0, sim.players.size - activePlayerCount),
    activePlayerLimit: sim.activePlayerLimit,
    playerRoster,
    players,
    npcs,
    bullets,
    drops,
    worldBuildings: getWorldSnapshot(sim.worldState)
  };

  if (sim.events.length > 0) {
    snapshot.events = sim.events.slice();
  }

  sim.events.length = 0;

  return snapshot;
}
