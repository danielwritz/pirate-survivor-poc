# Ship Growth Scenarios

> Visual/physical growth on level-up, weapon layout scaling, and stat progression feel.

---

### Scenario: Ship size grows +0.6 per level visually

The ship should visibly grow as it levels up, starting at BASE_SIZE 16 and gaining 0.6 per level. By level 20, the ship should be noticeably larger than at start.

**Given** a level 1 ship with size 16
**When** the ship reaches level 10
**Then** size should be approximately 21.4 (16 + 9×0.6)

```yaml
id: ship_size_growth_per_level
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { level: 1, size: 16, xp: 0, xpToNext: 8 }

actions:
  - levelUpTo: 10

assertions:
  - ship.size: { approx: 21.4, tolerance: 0.5 }
```

---

### Scenario: Weapon layout normalizes to hull size

When a ship grows, its weapon layout (port/starboard slot arrays) should re-normalize to reflect the larger hull. More weapon slots become available as the ship grows.

**Given** a ship with size 16 (4 slots per side)
**When** the ship grows to size 22
**And** weapon layout is re-normalized
**Then** slots per side should increase (floor based on hull formula)

```yaml
id: weapon_layout_scales_with_hull
tags: [progression, combat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { size: 16 }

actions:
  - setSize: 22
  - normalizeWeaponLayout: {}

assertions:
  - ship.weaponLayout.port.length: ">= 5"
  - ship.weaponLayout.starboard.length: ">= 5"
```

---

### Scenario: MaxHp scales +2 per level

A level 1 ship starts with BASE_HP 20. Each level adds +2 maxHp, making higher-level ships substantially tougher.

**Given** a level 1 ship with maxHp 20
**When** the ship reaches level 15
**Then** maxHp should be approximately 48 (20 + 14×2)

```yaml
id: maxhp_scales_per_level
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { level: 1, maxHp: 20, hp: 20, xp: 0, xpToNext: 8, size: 16 }

actions:
  - levelUpTo: 15

assertions:
  - ship.maxHp: { approx: 48, tolerance: 2 }
```

---

### Scenario: Mass increases with size affecting physics

As ship size grows, its effective mass should increase, affecting collision physics and inertia. Larger ships turn slower and have more momentum.

**Given** a ship with size 16 (BASE_MASS 28)
**When** the ship grows to size 22 through leveling
**Then** the ship's effective mass should be higher
**And** turn rate should be slightly reduced
**And** collision impact should be greater

```yaml
id: mass_increases_with_size
tags: [progression, physics]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  ship: { size: 16, mass: 28 }

actions:
  - growShip: { newSize: 22 }

assertions:
  - ship.mass: ">= 32"
```

---

### Scenario: Crew grows via upgrades not levels

Crew count should only increase through specific upgrades (e.g., "Press Gang", "Recruit"), not automatically on level-up. This makes crew upgrades feel meaningful.

**Given** a level 1 ship with crew 6
**When** the ship levels up 5 times (no crew upgrades selected)
**Then** crew should still be 6

```yaml
id: crew_from_upgrades_only
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { level: 1, crew: 6, xp: 0, xpToNext: 8 }

actions:
  - levelUpTo: 6
  # No crew-granting upgrades selected

assertions:
  - ship.crew: 6
```

---

### Scenario: Level 20 ship is significantly more powerful than level 1

A fully leveled ship should be dramatically more powerful than a starter ship, but not invincible. This validates the power fantasy curve.

**Given** a level 1 ship (size 16, maxHp 20)
**And** a level 20 ship (size ~27.4, maxHp ~58)
**When** their stats are compared
**Then** the level 20 ship should have roughly 3× the effective HP
**And** roughly 1.7× the size

```yaml
id: level20_power_vs_level1
tags: [progression, balance]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship1: { level: 1, size: 16, maxHp: 20 }
  ship20: { level: 20, size: 27.4, maxHp: 58 }

assertions:
  - ship20.maxHp / ship1.maxHp: { approx: 2.9, tolerance: 0.5 }
  - ship20.size / ship1.size: { approx: 1.7, tolerance: 0.2 }
```

---

### Scenario: Ship appearance reflects power tier at a glance

The rendered ship should visually communicate its power level so opponents can make tactical decisions. Larger size, more visible weapons, and hull details should scale.

**Given** ships at levels 1, 10, and 20
**When** rendered
**Then** each should be visually distinguishable by size alone
**And** weapon mount count should reflect upgrades applied

```yaml
id: visual_power_tier_recognition
tags: [progression, rendering]
status: pending
sprint: v0.7
priority: p2

setup:
  ships: [{ level: 1 }, { level: 10 }, { level: 20 }]

assertions:
  - ships[2].size: ">= ships[1].size"
  - ships[1].size: ">= ships[0].size"
  - sizeDifference_1_to_20: ">= 10"
```
