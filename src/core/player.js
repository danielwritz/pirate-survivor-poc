export const DEFAULT_HULL_DESIGN = {
  bodyHalfLenMul: 0.58,
  bodyHalfBeamMul: 0.72,
  sternBeamMul: 1,
  bowTipMul: 0.55,
  sternTipMul: 0.4
};

export const SHIPYARD_COST = {
  gun: 9,
  cannon: 22,
  crew: 8
};

export function createPlayer() {
  const player = {
    x: 1800,
    y: 1300,
    hp: 20,
    maxHp: 20,
    size: 16,
    heading: -Math.PI / 2,
    speed: 0,
    baseSpeed: 2.6,
    gunReload: 1.35,
    cannonReload: 3.4,
    gunTimer: 1.35,
    cannonTimer: 3.4,
    bulletDamage: 9,
    bulletSpeed: 6,
    rowers: 0,
    gunners: 2,
    repairCrew: 0,
    cannons: 0,
    cannonCapacityBonus: 0,
    cannonPivot: 0,
    crew: 2,
    rudder: 0,
    sailOpen: true,
    anchorDropped: false,
    collectorSkiffs: [],
    salvageSkiffCount: 0,
    lookoutRangeBonus: 0,
    hullArmorTier: 0,
    ram: false,
    ramDamage: 46,
    mass: 28,
    hullLength: 1,
    hullBeam: 1,
    bowSharpness: 1,
    sternTaper: 1,
    impactTimer: 0,
    repairSuppressed: 0,
    damageSeed: 1337,
    slots: [],
    hullColor: '#5f4630',
    sailColor: '#f0f7ff',
    mastScale: 1,
    maneuverPenalty: 0,
    trimColor: '#d9b78d',
    weaponLayout: { port: [], starboard: [] },
    hullDesign: { ...DEFAULT_HULL_DESIGN }
  };

  return player;
}
