# Regression Scenarios

> Cross-cutting invariants that must always pass on every merge to main.
> These validate the fundamental contracts of the game regardless of which sprint is active.

---

### Scenario: Ship JSON contract is stable

Every ship object must contain the core fields expected by both server and client. Adding a field is fine; removing or renaming one is a breaking change.

**Given** a ship is created via `createShipState()`
**When** the ship object is inspected
**Then** it must have at minimum: x, y, heading, speed, hp, maxHp, size, mass, level, xp, xpToNext, doubloons, crew, rowers, gunners, repairCrew, guns, cannons, alive

```yaml
id: regression_ship_json_contract
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

actions:
  - createShipState: {}

assertions:
  - ship.hasFields: [x, y, heading, speed, hp, maxHp, size, mass, level, xp, xpToNext, doubloons, crew, rowers, gunners, repairCrew, guns, cannons, alive]
```

---

### Scenario: Shared constants are importable by both server and client

The shared/constants.js module must be pure (no DOM, no fs, no Node-only APIs) so it can be imported on both server and client without errors.

**Given** shared/constants.js exists
**When** it is imported in a Node.js context
**Then** it should export TICK_RATE, ROUND_DURATION, BASE_HP, BASE_SPEED, MAX_NPCS without error

```yaml
id: regression_shared_constants_importable
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

actions:
  - import: shared/constants.js

assertions:
  - exports.TICK_RATE: 20
  - exports.ROUND_DURATION: 600
  - exports.BASE_HP: 20
  - exports.MAX_NPCS: 20
```

---

### Scenario: Physics determinism — same inputs produce same outputs

The shared physics module must be deterministic: given identical ship state and inputs, updateMovement must produce identical output every time. This is critical for replay and testing.

**Given** two identical ship states and identical inputs
**When** updateMovement is called on both
**Then** the resulting x, y, heading, and speed must be exactly equal

```yaml
id: regression_physics_determinism
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  shipA: { x: 100, y: 100, heading: 0, speed: 2.0, mass: 28, size: 16 }
  shipB: { x: 100, y: 100, heading: 0, speed: 2.0, mass: 28, size: 16 }
  input: { rowing: true, turning: 0.5 }

actions:
  - updateMovement: { ship: shipA, input: input }
  - updateMovement: { ship: shipB, input: input }

assertions:
  - shipA.x: shipB.x
  - shipA.y: shipB.y
  - shipA.heading: shipB.heading
  - shipA.speed: shipB.speed
```

---

### Scenario: Combat damage is always non-negative

No combat calculation should ever produce negative damage. Fire, guns, cannons, rams, and towers must always output damage >= 0.

**Given** any valid combat scenario
**When** damage is calculated
**Then** the result must be >= 0

```yaml
id: regression_damage_non_negative
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  scenarios:
    - { type: gun, damage: 1 }
    - { type: cannon, damage: 1 }
    - { type: ram, speed: 0.1 }
    - { type: fire, tick: 1 }
    - { type: tower, level: 0 }

assertions:
  - allDamageValues: ">= 0"
```

---

### Scenario: Upgrade application never produces NaN or undefined stats

Applying any upgrade from the catalog to any ship state should never result in NaN, undefined, or Infinity for any numeric ship property.

**Given** a freshly created ship
**When** every upgrade in the catalog is applied sequentially
**Then** all numeric properties should remain finite numbers

```yaml
id: regression_no_nan_from_upgrades
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { fresh: true }
  catalog: { all: true }

actions:
  - applyAllUpgrades: {}

assertions:
  - ship.allNumericFields: { each: isFinite }
```

---

### Scenario: XP curve produces strictly increasing thresholds

The XP-to-next-level formula (prev × XP_SCALE + XP_ADD) must produce strictly increasing values for every level. A flat or decreasing curve would break progression.

**Given** the XP formula with XP_START=8, XP_SCALE=1.18, XP_ADD=3
**When** xpToNext is calculated for levels 1 through 30
**Then** each value should be strictly greater than the previous

```yaml
id: regression_xp_curve_increasing
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

actions:
  - calculateXpCurve: { levels: 30 }

assertions:
  - curve: { strictlyIncreasing: true }
```

---

### Scenario: NPC cap is enforced under all conditions

The server must never have more than MAX_NPCS (20) alive NPCs at once, regardless of spawn rate, player count, or round time.

**Given** a round at maximum spawn rate with 10 players
**When** the NPC director attempts to spawn
**Then** total alive NPCs must not exceed 20

```yaml
id: regression_npc_cap_enforced
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  roundTime: 500
  playerCount: 10
  currentNpcs: 19

actions:
  - tickNpcDirector: { forceSpawn: true }
  - tickNpcDirector: { forceSpawn: true }

assertions:
  - aliveNpcs: "<= 20"
```

---

### Scenario: World boundaries are enforced

No ship (player or NPC) should ever have coordinates outside the world bounds (0 to WORLD_WIDTH, 0 to WORLD_HEIGHT) after a physics tick.

**Given** a ship at the edge of the world moving outward
**When** a physics tick is processed
**Then** the ship's position should be clamped within world bounds

```yaml
id: regression_world_boundaries
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { x: 2999, y: 2099, heading: 0.3, speed: 5.0 }

actions:
  - updateMovement: {}

assertions:
  - ship.x: "<= 3000"
  - ship.y: "<= 2100"
  - ship.x: ">= 0"
  - ship.y: ">= 0"
```

---

### Scenario: All existing unit tests pass

The full Vitest suite (`npm test`) must pass with 0 failures. This is the baseline regression gate.

**Given** the current codebase
**When** `npm test` is executed
**Then** all tests should pass with exit code 0

```yaml
id: regression_unit_tests_pass
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

actions:
  - runCommand: npm test

assertions:
  - exitCode: 0
  - failures: 0
```

---

### Scenario: Server starts without errors

The server should start cleanly, load the upgrade catalog, initialize the leaderboard database, and begin accepting WebSocket connections.

**Given** a clean environment with Node.js >= 22
**When** `node server/index.js` is executed
**Then** the server should log successful startup messages
**And** the WebSocket server should be listening

```yaml
id: regression_server_starts_clean
tags: [regression]
status: passing
sprint: v0.6-existing
priority: p0

actions:
  - runCommand: node server/index.js

assertions:
  - stdout: { contains: "listening" }
  - exitCode: null  # still running
```
