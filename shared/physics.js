/**
 * Shared ship physics — full movement model with crew-scaled mechanics.
 * Runs on both server and client. No DOM/canvas deps.
 *
 * Replaces the simplified shipPhysics.js with the full SP movement model
 * including rowing, sail, wind resistance, anchor, inertia, and steering.
 */

import { clamp } from '../src/core/math.js';
import {
  PACE,
  ROW_ACCEL_BASE, ROW_ACCEL_PER_ROWER,
  SAIL_PUSH_BASE, SAIL_PUSH_SIZE_FACTOR,
  TURN_BASE, TURN_RUDDER, TURN_ROWER,
  BRAKE_DRAG, IDLE_DRAG,
  INERTIA_BASE_MASS, INERTIA_DIVISOR, ACCEL_MASS_DIVISOR,
  WIND_RESIST_PER_ROWER, WIND_RESIST_MAX,
  WIND_DRIFT_FACTOR, WIND_DRIFT_PACE,
  SPEED_CAP_OFFSET,
  WORLD_EDGE_PAD,
  COLLISION_RADIUS_MUL, IMPACT_COOLDOWN, MIN_IMPACT_SPEED, RESTITUTION,
  RAM_MULTIPLIER, RAM_SELF_REDUCTION
} from './constants.js';

// ─── Helpers ───

export function forwardVector(heading) {
  return { x: Math.cos(heading), y: Math.sin(heading) };
}

function getInertia(mass) {
  return 1 + Math.max(0, (mass - INERTIA_BASE_MASS) / INERTIA_DIVISOR);
}

// ─── Main movement step ───

/**
 * Step a single ship's physics forward by dt seconds.
 * Mutates ship in place.
 *
 * @param {object} ship   - Ship state (from createShip)
 * @param {object} input  - { forward, brake, turnLeft, turnRight, sailOpen, anchored }
 * @param {object} wind   - { x, y }
 * @param {object} world  - { width, height }
 * @param {number} dt     - Delta time in seconds
 */
export function stepShipPhysics(ship, input, wind, world, dt) {
  // Sync sail/anchor from input
  ship.sailOpen = !!input.sailOpen;
  ship.anchorDropped = !!input.anchored;

  // Anchor = frozen
  if (ship.anchorDropped) {
    ship.speed = 0;
    return;
  }

  const pace = dt * PACE;              // SP uses dt * 12
  const inertia = getInertia(ship.mass);
  const accelDiv = Math.max(1, (ship.mass || 28) / ACCEL_MASS_DIVISOR) * inertia;  // SP formula
  const fwd = forwardVector(ship.heading);

  // ─── Rowing ───
  if (input.forward) {
    const rowPower = ROW_ACCEL_BASE + (ship.rowers || 0) * ROW_ACCEL_PER_ROWER;
    ship.speed += (rowPower / accelDiv) * pace;
  }

  // ─── Sail push ───
  if (ship.sailOpen && wind) {
    const alignment = fwd.x * wind.x + fwd.y * wind.y;
    if (alignment > 0) {
      const push = alignment * (SAIL_PUSH_BASE + (ship.size || 16) * SAIL_PUSH_SIZE_FACTOR);
      ship.speed += (push / accelDiv) * pace;
    }
  }

  // ─── Wind drift (lateral push) ───
  if (wind) {
    const rowerResist = clamp((ship.rowers || 0) * WIND_RESIST_PER_ROWER, 0, WIND_RESIST_MAX);
    const driftFactor = (1 - rowerResist) * WIND_DRIFT_FACTOR * dt * WIND_DRIFT_PACE;
    ship.x += wind.x * driftFactor;
    ship.y += wind.y * driftFactor;
  }

  // ─── Drag (linear, matches SP) ───
  const drag = input.brake ? BRAKE_DRAG : IDLE_DRAG;
  ship.speed -= drag * ship.speed * pace;

  // ─── Speed cap ───
  const maxSpeed = (ship.baseSpeed || 2.6) + SPEED_CAP_OFFSET;
  ship.speed = clamp(ship.speed, 0, maxSpeed);

  // ─── Steering ───
  const turnInput = (input.turnLeft ? -1 : 0) + (input.turnRight ? 1 : 0);
  if (turnInput !== 0) {
    const steerDiv = 1 + Math.max(0, ((ship.mass || 28) - INERTIA_BASE_MASS) / 40);  // SP uses /40
    const turnRate = (TURN_BASE + (ship.rudder || 0) * TURN_RUDDER + (ship.rowers || 0) * TURN_ROWER)
      / steerDiv
      * (1 - (ship.maneuverPenalty || 0));
    const speedFactor = 0.3 + Math.min(1.2, ship.speed / 2.4);
    ship.heading += turnInput * turnRate * speedFactor * pace;
  }

  // ─── Position ───
  ship.x += fwd.x * ship.speed * pace;
  ship.y += fwd.y * ship.speed * pace;

  // ─── World clamp ───
  ship.x = clamp(ship.x, WORLD_EDGE_PAD, world.width - WORLD_EDGE_PAD);
  ship.y = clamp(ship.y, WORLD_EDGE_PAD, world.height - WORLD_EDGE_PAD);
}

// ─── Ship-to-ship collision resolution ───

/**
 * Resolve a collision between two ships. Handles separation, speed reduction,
 * and impact damage (including ramming).
 *
 * @param {object} shipA   - First ship
 * @param {object} shipB   - Second ship
 * @param {object} world   - { width, height }
 * @returns {{ impactA: number, impactB: number } | null} - Damage to apply (null if no collision)
 */
export function resolveShipCollision(shipA, shipB, world) {
  const dx = shipB.x - shipA.x;
  const dy = shipB.y - shipA.y;
  const d = Math.hypot(dx, dy);
  const minDist = (shipA.size || 16) * COLLISION_RADIUS_MUL + (shipB.size || 16) * COLLISION_RADIUS_MUL;

  if (d >= minDist || d < 0.001) return null;

  const nx = dx / d;
  const ny = dy / d;
  const overlap = minDist - d;
  const totalMass = (shipA.mass || 28) + (shipB.mass || 28);

  // Separate
  const pushScale = 1.18;
  shipA.x -= nx * overlap * pushScale * ((shipB.mass || 28) / totalMass);
  shipA.y -= ny * overlap * pushScale * ((shipB.mass || 28) / totalMass);
  shipB.x += nx * overlap * pushScale * ((shipA.mass || 28) / totalMass);
  shipB.y += ny * overlap * pushScale * ((shipA.mass || 28) / totalMass);

  // Clamp
  shipA.x = clamp(shipA.x, WORLD_EDGE_PAD, world.width - WORLD_EDGE_PAD);
  shipA.y = clamp(shipA.y, WORLD_EDGE_PAD, world.height - WORLD_EDGE_PAD);
  shipB.x = clamp(shipB.x, WORLD_EDGE_PAD, world.width - WORLD_EDGE_PAD);
  shipB.y = clamp(shipB.y, WORLD_EDGE_PAD, world.height - WORLD_EDGE_PAD);

  // Relative normal speed
  const fwdA = forwardVector(shipA.heading);
  const fwdB = forwardVector(shipB.heading);
  const velAn = fwdA.x * shipA.speed * nx + fwdA.y * shipA.speed * ny;
  const velBn = fwdB.x * shipB.speed * nx + fwdB.y * shipB.speed * ny;
  const relNormalSpeed = velAn - velBn;

  if (relNormalSpeed < MIN_IMPACT_SPEED) return null;

  // Impact damage
  let impactA = 0;
  let impactB = 0;

  if ((shipA.impactTimer || 0) <= 0 && (shipB.impactTimer || 0) <= 0) {
    const impactForce = relNormalSpeed * 0.55;
    impactA = Math.max(0, impactForce * ((shipB.mass || 28) / (shipA.mass || 28)) * 0.32);
    impactB = Math.max(0, impactForce * ((shipA.mass || 28) / (shipB.mass || 28)) * 0.32);

    // Bow dot for ramming
    const bowDotA = fwdA.x * nx + fwdA.y * ny;     // >0 = A is bow-on
    const bowDotB = -(fwdB.x * nx + fwdB.y * ny);  // >0 = B is bow-on

    // Ram bonus for A hitting B
    if (shipA.ram && bowDotA > 0.5) {
      const ramBonus = (shipA.ramDamage || 0) * bowDotA * (0.5 + shipA.speed * 0.3);
      impactB += ramBonus * RAM_MULTIPLIER;
      impactA *= RAM_SELF_REDUCTION;  // ramming ship takes less self-damage
    }

    // Ram bonus for B hitting A
    if (shipB.ram && bowDotB > 0.5) {
      const ramBonus = (shipB.ramDamage || 0) * bowDotB * (0.5 + shipB.speed * 0.3);
      impactA += ramBonus * RAM_MULTIPLIER;
      impactB *= RAM_SELF_REDUCTION;
    }

    shipA.impactTimer = IMPACT_COOLDOWN;
    shipB.impactTimer = IMPACT_COOLDOWN;
  }

  // Speed reduction
  const impulse = (1 + RESTITUTION) * relNormalSpeed / (1 / (shipA.mass || 28) + 1 / (shipB.mass || 28));
  shipA.speed = Math.max(0, shipA.speed - (impulse / (shipA.mass || 28)) * 0.58);
  shipB.speed = Math.max(0, shipB.speed - (impulse / (shipB.mass || 28)) * 0.58);

  return {
    impactA: impactA > 0.35 ? impactA : 0,
    impactB: impactB > 0.35 ? impactB : 0
  };
}
