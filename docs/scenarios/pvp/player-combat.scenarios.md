# Player Combat Scenarios

> PvP engagement, weapon systems, crew efficiency, fire mechanics, and ramming between player ships.

---

### Scenario: Gun fires within pivot arc toward nearest target

Guns should fire forward within GUN_PIVOT_RAD (30°) with GUN_SPREAD (0.18 rad) randomization. Shots that leave this arc should not fire.

**Given** a player ship facing north with a target 20° to port
**When** the gun reload timer expires
**Then** a gun bullet should be spawned within the forward arc
**And** the bullet should have speed BASE_BULLET_SPEED + BULLET_SPEED_GUN_BONUS (6.2)

```yaml
id: gun_fires_within_pivot_arc
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { heading: 0, gunReloadTimer: 0 }
  target: { angle: -20deg, range: 80 }

actions:
  - tickWeapons: {}

assertions:
  - bulletSpawned: true
  - bullet.speed: { approx: 6.2, tolerance: 0.3 }
```

---

### Scenario: Cannon broadside fires from port/starboard

Cannons fire perpendicular to the ship's heading (port and starboard broadsides). Each side fires independently based on target availability.

**Given** a player ship with 2 cannons on port side
**And** an enemy positioned to port
**When** the cannon reload timer expires on port side
**Then** 2 cannon bullets should be spawned from the port side
**And** bullets should have CANNON_DMG_BONUS (+4 damage)

```yaml
id: cannon_broadside_fires
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { cannonsPort: 2, cannonReloadTimer: 0 }
  target: { side: port, range: 150 }

actions:
  - tickWeapons: {}

assertions:
  - cannonBulletsFired: 2
  - bullet.damageBonus: 4
```

---

### Scenario: Crew efficiency modifies fire rate

Crew efficiency (based on total crew vs. weapon demand) scales weapon reload speed. Undermanned ships fire slower; well-crewed ships fire faster (up to 1.88× cap).

**Given** a ship with 8 crew, 4 guns (demand 2.2), 2 cannons (demand 2.3) — total demand 4.5
**When** crew efficiency is calculated
**Then** efficiency should be between CREW_EFFICIENCY_MIN (0.72) and CREW_EFFICIENCY_MAX (1.88)

```yaml
id: crew_efficiency_modifies_firerate
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { crew: 8, guns: 4, cannons: 2 }

actions:
  - calculateCrewEfficiency: {}

assertions:
  - efficiency: ">= 0.72"
  - efficiency: "<= 1.88"
```

---

### Scenario: Ram damage on bow collision

When a ship's bow strikes another ship, ram damage is calculated from BASE_RAM_DAMAGE (46), speed, mass, and upgrade bonuses. This rewards aggressive positioning.

**Given** ship A (speed 3.5, ramDamage 46) collides bow-first with ship B
**When** the collision angle is within RAM_BOW_THRESHOLD (0.42 rad)
**Then** ship B should take ram damage
**And** ship A should take reduced self-damage (RAM_SELF_REDUCTION 24%)

```yaml
id: ram_damage_on_bow_collision
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  shipA: { speed: 3.5, ramDamage: 46, heading: 0 }
  shipB: { x: 50, y: 0 }
  collisionAngle: 0.1

actions:
  - processCollision: {}

assertions:
  - shipB.damageTaken: ">= 10"
  - shipA.selfDamage: ">= 1"
```

---

### Scenario: Fire ignition on damage

Hits have a chance to ignite the target: FIRE_CHANCE_BASE (16%) + FIRE_CHANCE_PER_DMG × damage. Fire deals FIRE_DMG_PLAYER (0.52) per tick for FIRE_DURATION_BASE (3s).

**Given** a player hit deals 12 damage to another player
**When** the fire roll succeeds (16% + 12×0.8% = 25.6% chance)
**Then** the target should be on fire
**And** fire should deal ~0.52 damage every 0.2 seconds for 3 seconds

```yaml
id: fire_ignition_on_damage
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  target: { hp: 40, onFire: false }
  damageDealt: 12

actions:
  - applyDamage: { amount: 12, fireRollForced: true }

assertions:
  - target.onFire: true
  - target.fireDuration: { approx: 3.0, tolerance: 0.5 }
  - target.fireDmgPerTick: { approx: 0.52, tolerance: 0.1 }
```

---

### Scenario: Gun range scales with guns, gunners, and level

Effective gun range = GUN_RANGE_BASE (124) + guns×3 + gunners×4 + level×0.8. This makes range a composite stat that improves organically.

**Given** a ship with 4 guns, 4 gunners, level 10
**When** effective gun range is calculated
**Then** range should be approximately 124 + 12 + 16 + 8 = 160

```yaml
id: gun_range_composite_scaling
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { guns: 4, gunners: 4, level: 10 }

actions:
  - calculateGunRange: {}

assertions:
  - gunRange: { approx: 160, tolerance: 5 }
```

---

### Scenario: Cannon range significantly exceeds gun range

Cannons should have meaningfully longer range than guns (CANNON_RANGE_BASE 236 vs GUN_RANGE_BASE 124), rewarding players who position for broadside engagements.

**Given** a ship with 2 guns and 2 cannons
**When** both weapon ranges are calculated
**Then** cannon range should exceed gun range by at least CANNON_RANGE_MIN_OVER_GUN (70)

```yaml
id: cannon_range_exceeds_gun_range
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  ship: { guns: 2, cannons: 2, level: 5 }

actions:
  - calculateWeaponRanges: {}

assertions:
  - cannonRange - gunRange: ">= 70"
```

---

### Scenario: Repair suppressed after taking damage

After taking damage, repair is paused for REPAIR_SUPPRESS_TIME (2.4s). This prevents tanking through sustained fire via instant healing.

**Given** a ship with repair crew and damage taken 0.5 seconds ago
**When** the repair tick runs
**Then** no HP should be restored (within suppression window)

```yaml
id: repair_suppressed_after_damage
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { hp: 15, maxHp: 30, repairCrew: 2, lastDamageTime: 0.5 }

actions:
  - tickRepair: { currentTime: 1.0 }

assertions:
  - ship.hp: 15
```

---

### Scenario: Repair rate scales with crew

After the suppression window, repair rate = REPAIR_RATE_BASE (0.36) + repairCrew × REPAIR_RATE_PER_CREW (0.3). More repair crew = faster sustain.

**Given** a ship with 3 repair crew, not suppressed
**When** 1 second of repair ticks pass
**Then** HP restored should be approximately 1.26 (0.36 + 3×0.3)

```yaml
id: repair_rate_scales_with_crew
tags: [pvp, combat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { hp: 20, maxHp: 40, repairCrew: 3, lastDamageTime: -10 }

actions:
  - tickRepair: { duration: 1.0 }

assertions:
  - ship.hpGained: { approx: 1.26, tolerance: 0.2 }
```
