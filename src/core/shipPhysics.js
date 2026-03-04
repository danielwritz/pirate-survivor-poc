/**
 * Shared ship physics — runs on both server (Node.js) and client (browser).
 * Pure functions, no DOM or canvas dependencies.
 */

/**
 * Clamp a value between min and max.
 */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Compute the forward unit vector from a heading angle (radians).
 */
export function forwardVector(heading) {
  return { x: Math.cos(heading), y: Math.sin(heading) };
}

/**
 * @typedef {Object} ShipInput
 * @property {boolean} forward   - W / ArrowUp
 * @property {boolean} brake     - S / ArrowDown
 * @property {boolean} turnLeft  - A / ArrowLeft
 * @property {boolean} turnRight - D / ArrowRight
 * @property {boolean} sailOpen  - sail toggled open
 * @property {boolean} anchored  - anchor dropped
 */

/**
 * Step a single ship's physics forward by `dt` seconds.
 * Mutates `ship` in place. Pure physics — no rendering, no spawning, no combat.
 *
 * @param {Object} ship   - Mutable ship entity (x, y, heading, speed, etc.)
 * @param {ShipInput} input - Current frame input state
 * @param {Object} wind   - { x, y } wind vector
 * @param {Object} world  - { width, height } world bounds
 * @param {number} dt     - Delta time in seconds
 */
export function stepShipPhysics(ship, input, wind, world, dt) {
  const fwd = forwardVector(ship.heading);
  const windMag = Math.hypot(wind.x, wind.y) || 1;
  const windDir = { x: wind.x / windMag, y: wind.y / windMag };

  const anchored = !!input.anchored;
  const pace = dt * 12;

  // Row power
  const rowPower = (!anchored && input.forward) ? (0.14 + (ship.rowers || 0) * 0.075) : 0;

  // Sail push
  const sailAlignment = (!anchored && input.sailOpen)
    ? Math.max(0, fwd.x * windDir.x + fwd.y * windDir.y)
    : 0;
  const sailPush = input.sailOpen ? sailAlignment * (0.11 + ship.size * 0.0018) : 0;

  // Drag
  const drag = input.brake ? 0.06 : 0.018;

  // Inertia and acceleration
  const inertia = 1 + Math.max(0, ((ship.mass || 28) - 28) / 44);
  const accel = (rowPower + sailPush) / Math.max(1, (ship.mass || 28) / 16) / inertia;

  if (!anchored) {
    ship.speed += accel * pace;
    ship.speed -= drag * ship.speed * pace;
    ship.speed = Math.max(0, Math.min((ship.baseSpeed || 2.6) + 1.9, ship.speed));
  } else {
    ship.speed = 0;
  }

  // Steering
  const steerAuthorityBase = 0.036 + (ship.rudder || 0) * 0.006 + (ship.rowers || 0) * 0.002;
  const steerAuthority = steerAuthorityBase
    / (1 + Math.max(0, ((ship.mass || 28) - 28) / 40))
    * (1 - (ship.maneuverPenalty || 0));
  const speedFactor = 0.3 + Math.min(1.2, ship.speed / 2.4);

  if (input.turnLeft) ship.heading -= steerAuthority * speedFactor * pace;
  if (input.turnRight) ship.heading += steerAuthority * speedFactor * pace;

  // Wind drift
  const rowerMitigation = Math.min(0.85, (ship.rowers || 0) * 0.16);
  const wx = wind.x * (1 - rowerMitigation) * 0.18;
  const wy = wind.y * (1 - rowerMitigation) * 0.18;

  // Position update
  if (!anchored) {
    ship.x += fwd.x * ship.speed * pace + wx * dt * 2.8;
    ship.y += fwd.y * ship.speed * pace + wy * dt * 2.8;
  }

  // World bounds clamping
  ship.x = Math.max(24, Math.min(world.width - 24, ship.x));
  ship.y = Math.max(24, Math.min(world.height - 24, ship.y));
}

/**
 * Create a default ship entity with starter stats.
 */
export function createDefaultShip(x, y) {
  return {
    x,
    y,
    heading: -Math.PI / 2,
    speed: 0,
    baseSpeed: 2.6,
    size: 16,
    mass: 28,
    rowers: 1,
    rudder: 0,
    maneuverPenalty: 0,
    sailOpen: true,
    anchorDropped: false,
    // Visual properties for client rendering
    hullColor: '#5f4630',
    sailColor: '#f0f7ff',
    trimColor: '#d9b78d'
  };
}
