/**
 * Shared constants — single source of truth for all tuning values.
 * Used by both server and client. No DOM/canvas dependencies.
 */

// ─── Tick / Timing ───
export const TICK_RATE = 20;
export const TICK_INTERVAL = 1 / TICK_RATE;
export const ROUND_DURATION = 10 * 60;        // 10 minutes

// ─── World ───
export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 2100;
export const WORLD_EDGE_PAD = 24;
export const WIND_SHIFT_INTERVAL = 18;
export const WIND_STRENGTH_BASE = 0.24;
export const WIND_STRENGTH_RANGE = 0.4;

// ─── Ship defaults ───
export const BASE_SPEED = 2.6;
export const BASE_MASS = 28;
export const BASE_SIZE = 16;
export const BASE_HP = 20;
export const BASE_RUDDER = 0;
export const BASE_GUN_RELOAD = 1.35;
export const BASE_CANNON_RELOAD = 3.4;
export const BASE_BULLET_DAMAGE = 9;
export const BASE_BULLET_SPEED = 6;
export const BASE_RAM_DAMAGE = 46;
export const STARTING_CREW = 2;
export const STARTING_GUNNERS = 2;

// ─── Movement ───
export const PACE = 12;                          // movement-rate multiplier (SP uses dt*12)
export const ROW_ACCEL_BASE = 0.14;
export const ROW_ACCEL_PER_ROWER = 0.075;
export const ENEMY_ROW_ACCEL_BASE = 0.12;
export const ENEMY_ROW_ACCEL_PER_ROWER = 0.06;
export const SAIL_PUSH_BASE = 0.15;
export const SAIL_PUSH_SIZE_FACTOR = 0.0024;
export const SAIL_UPWIND_FACTOR = 0.42;
export const TURN_BASE = 0.036;
export const TURN_RUDDER = 0.006;
export const TURN_ROWER = 0.002;
export const BRAKE_DRAG = 0.06;
export const IDLE_DRAG = 0.018;
export const INERTIA_BASE_MASS = 28;
export const INERTIA_DIVISOR = 44;
export const ACCEL_MASS_DIVISOR = 16;          // SP accel divisor: max(1, mass/16)
export const WIND_RESIST_PER_ROWER = 0.16;   // fraction per rower (matches SP)
export const WIND_RESIST_MAX = 0.85;
export const WIND_DRIFT_FACTOR = 0.18;         // SP wind drift lateral push
export const WIND_DRIFT_PACE = 2.8;           // SP wind drift dt multiplier
export const SPEED_CAP_OFFSET = 1.9;           // SP: maxSpeed = baseSpeed + 1.9

// ─── Combat: Guns ───
export const GUN_PIVOT_RAD = 30 * (Math.PI / 180);
export const GUN_SPREAD = 0.18;
export const BULLET_SPEED_GUN_BONUS = 0.2;   // added to player bulletSpeed
export const INCOMING_DMG_SCALE_GUN = 0.18;

// ─── Combat: Cannons ───
export const CANNON_PIVOT_RAD_BASE = 0;       // per-ship cannonPivot upgrades this
export const CANNON_SPREAD = 0.1;
export const BULLET_SPEED_CANNON_BONUS = 0.45;
export const CANNON_DMG_BONUS = 4;            // flat bonus on cannon bullets
export const INCOMING_DMG_SCALE_CANNON = 0.28;
export const CANNON_VOLLEY_COOLDOWN = 0.6;    // seconds between cannon volleys per side

// ─── Combat: Range ───
export const GUN_RANGE_BASE = 124;
export const GUN_RANGE_PER_GUN = 3;
export const GUN_RANGE_PER_GUNNER = 4;
export const GUN_RANGE_PER_LEVEL = 0.8;
export const CANNON_RANGE_MIN_OVER_GUN = 70;
export const CANNON_RANGE_BASE = 236;
export const CANNON_RANGE_PER_CANNON = 20;
export const CANNON_RANGE_PER_PIVOT = 1.6;
export const CANNON_RANGE_PER_LEVEL = 1.2;

// ─── Combat: Crew efficiency ───
export const CREW_EFFICIENCY_A = 1.52;
export const CREW_EFFICIENCY_B = 0.58;
export const CREW_EFFICIENCY_MIN = 0.72;
export const CREW_EFFICIENCY_MAX = 1.88;
export const WEAPON_DEMAND_PER_GUN = 0.55;
export const WEAPON_DEMAND_PER_CANNON = 1.15;

// ─── Combat: Fire / Ignition ───
export const FIRE_CHANCE_BASE = 0.16;
export const FIRE_CHANCE_PER_DMG = 0.008;
export const FIRE_TICK_INTERVAL = 0.2;        // seconds between fire ticks
export const FIRE_DMG_PLAYER = 0.52;
export const FIRE_DMG_ENEMY = 0.68;
export const FIRE_DURATION_BASE = 3.0;        // seconds

// ─── Collision ───
export const COLLISION_RADIUS_MUL = 0.72;
export const IMPACT_COOLDOWN = 0.18;
export const MIN_IMPACT_SPEED = 0.55;
export const MIN_IMPACT_SPEED_DIFF = 0.3;
export const RESTITUTION = 0.24;
export const RAM_BOW_THRESHOLD = 0.42;
export const RAM_DAMAGE_SCALE = 0.075;
export const RAM_SPEED_BASE = 0.18;
export const RAM_SPEED_FACTOR = 0.72;
export const RAM_SPEED_ADVANTAGE_FACTOR = 0.28;
export const RAM_MULTIPLIER = 1.15;
export const RAM_SELF_REDUCTION = 0.24;

// ─── HP / Repair ───
export const REPAIR_RATE_BASE = 0.36;
export const REPAIR_RATE_PER_CREW = 0.3;
export const REPAIR_SUPPRESS_TIME = 2.4;

// ─── Death / Respawn ───
export const DOUBLOON_DROP_RATIO = 0.20;
export const RESPAWN_INVULN = 2.0;

// ─── Doubloon pickup ───
export const DOUBLOON_PICKUP_RADIUS = 28;
export const DOUBLOON_MAGNET_RADIUS = 90;
export const DOUBLOON_MAGNET_SPEED = 2.0;
export const DOUBLOON_TIMEOUT = 30;           // seconds before uncollected drops vanish
export const GOLD_MAGNET_PULL_FACTOR = 0.95;
export const GOLD_MAGNET_BASE_SPEED = 2.1;

// ─── XP / Levels ───
export const XP_START = 8;
export const XP_SCALE = 1.18;
export const XP_ADD = 3;
export const PASSIVE_DOUBLOON_RATE = 0.5;     // doubloons/second for staying alive

// ─── Boss kill rewards ───
export const BOSS_KILL_BASE_DOUBLOONS = 50;   // doubloons awarded at tier 0
export const BOSS_KILL_DOUBLOONS_PER_TIER = 10; // additional doubloons per difficulty tier
export const BOSS_SPLASH_RADIUS = 300;          // units — players within this radius get splash
export const BOSS_SPLASH_PERCENT = 0.3;         // fraction of base reward for splash players

// ─── Difficulty Stages ───
export const STAGE_CALM_WATERS    = 'calm_waters';
export const STAGE_CONTESTED_SEAS = 'contested_seas';
export const STAGE_WAR_ZONE       = 'war_zone';
export const STAGE_KRAKEN_FRONTIER = 'kraken_frontier';

export const STAGE_BOUNDARIES = [
  { stage: STAGE_CALM_WATERS,     start:   0, end: 120 },
  { stage: STAGE_CONTESTED_SEAS,  start: 120, end: 300 },
  { stage: STAGE_WAR_ZONE,        start: 300, end: 480 },
  { stage: STAGE_KRAKEN_FRONTIER, start: 480, end: 600 }
];

/** Archetype keys allowed per stage */
export const STAGE_ARCHETYPE_POOLS = {
  [STAGE_CALM_WATERS]:     ['weak', 'standard'],
  [STAGE_CONTESTED_SEAS]:  ['weak', 'standard', 'heavy'],
  [STAGE_WAR_ZONE]:        ['weak', 'standard', 'heavy', 'scavenger'],
  [STAGE_KRAKEN_FRONTIER]: ['weak', 'standard', 'heavy', 'scavenger']
};

// ─── NPC ───
export const MAX_NPCS = 20;
export const NPC_SPAWN_INTERVAL_BASE = 3.5;    // seconds between spawns, decreases with time
export const NPC_BASE_DOUBLOON_REWARD = 3;
export const NPC_DOUBLOON_PER_UPGRADE = 2;

// ─── Islands ───
export const ISLAND_COUNT = 18;
export const ISLAND_CONTACT_SPEED_MUL = 0.25;
export const ISLAND_CONTACT_DMG_BASE = 3.5;
export const ISLAND_CONTACT_DMG_MASS = 0.03;

// ─── Tower defenses ───
export const TOWER_CHANCE_BASE = 0.18;
export const TOWER_CHANCE_PER_TIER = 0.08;
export const TOWER_CHANCE_MAX = 0.85;
export const TOWER_FIRE_RATE_BASE = 1.6;
export const TOWER_FIRE_RATE_MIN = 0.7;
export const TOWER_FIRE_RATE_PER_LEVEL = 0.12;
export const TOWER_DMG_BASE = 5;
export const TOWER_DMG_PER_LEVEL = 1.5;

// ─── Building ───
export const BUILDING_HP_BASE = 18;
export const BUILDING_HP_SIZE_MUL = 1.6;
export const BUILDING_DMG_CANNON_SCALE = 1.05;
export const BUILDING_DMG_GUN_SCALE = 0.58;
export const BUILDING_GOLD_MIN = 2;

// ─── Boss: War Galleon ───
export const WAR_GALLEON_SIZE_MUL = 3.0;           // ~3x player BASE_SIZE
export const WAR_GALLEON_CANNON_COUNT = 6;          // 3 cannons per side, 6 total
export const WAR_GALLEON_BROADSIDE_INTERVAL = 4.0;  // seconds between full broadside volleys
export const WAR_GALLEON_CANNON_DAMAGE = 12;        // bulletDamage for each cannonball
export const WAR_GALLEON_HP_PER_TIER = 50;          // HP = 50*tier + 20*player_count
export const WAR_GALLEON_HP_PER_PLAYER = 20;

// ─── Vision ───
export const VISION_BASE_OFFSET = 44;
export const VISION_MIN = 180;
export const VISION_MAX = 980;
export const LOOKOUT_BONUS_MAX = 520;

// ─── Boss ───
export const BOSS_FIRST_SPAWN_TIME = 150;     // seconds into round when first boss spawns
export const BOSS_SPAWN_INTERVAL = 135;        // minimum seconds between boss spawn attempts
export const BOSS_TIER_DURATION = 150;         // seconds per difficulty tier
export const BOSS_MAX_TIER = 4;
export const BOSS_HP_BASE = 200;
export const BOSS_HP_PER_TIER = 80;
export const BOSS_HP_PER_PLAYER = 40;

// ─── Boss: Kraken ───
export const KRAKEN_AREA_RADIUS = 160;          // tentacle hazard zone radius (>= 150)
export const KRAKEN_DMG_PER_TICK = 2.5;         // damage dealt to ships per area pulse
export const KRAKEN_PULSE_INTERVAL = 1.5;       // seconds between damage pulses
export const KRAKEN_HP_BASE = 800;              // base HP at tier 0
export const KRAKEN_HP_PER_TIER = 120;          // additional HP per difficulty tier

// ─── Camera ───
export const CAMERA_ZOOM_BASE = 2.0;
export const CAMERA_ZOOM_PER_LOOKOUT = -0.0012;  // zoom out as crow's nest grows
export const CAMERA_ZOOM_MIN = 0.6;
export const CAMERA_ZOOM_MAX = 2.4;

// ─── Fire Ship Boss ───
export const FIRE_SHIP_SPEED_MUL = 1.35;          // 35% faster than base NPC speed
export const FIRE_SHIP_SIZE_MUL = 0.80;            // slightly smaller than standard
export const FIRE_SHIP_HP_BASE = 60;               // base HP (scales with tier + player count)
export const FIRE_SHIP_RAM_DAMAGE = 55;            // flat ram damage applied to target on collision
export const FIRE_SHIP_FIRE_DURATION_MUL = 2.0;   // fire duration multiplier (2× base)
export const FIRE_SHIP_DOUBLOON_REWARD = 25;       // base doubloon drop on death (scales with tier)
