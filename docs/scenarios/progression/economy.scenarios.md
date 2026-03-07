# Economy Scenarios

> Doubloon sources, spending, death penalties, and round-end scoring.

---

### Scenario: NPC kill rewards scale with upgrade count

NPCs should reward BASE 3 doubloons + 2 per upgrade they carry. Higher-tier NPCs are worth more, incentivizing players to seek harder fights.

**Given** a player kills an NPC with 6 random upgrades
**When** the reward is calculated
**Then** the player should receive 15 doubloons (3 + 6×2)

```yaml
id: npc_reward_scales_with_upgrades
tags: [economy, pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  npc: { upgradeCount: 6 }

actions:
  - killNpc: { killer: player }

assertions:
  - reward: 15
```

---

### Scenario: Passive income of 0.5 doubloons per second

Players earn PASSIVE_DOUBLOON_RATE (0.5) doubloons per second while alive, providing a floor income that prevents total stagnation.

**Given** a living player ship
**When** 20 seconds pass without any combat or island interaction
**Then** the ship should have earned approximately 10 passive doubloons

```yaml
id: passive_income_rate
tags: [economy]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { alive: true, doubloons: 0 }

actions:
  - advanceTime: 20

assertions:
  - ship.doubloons: { approx: 10, tolerance: 2 }
```

---

### Scenario: Building destruction drops doubloons

Destroying island buildings should drop doubloon pickups. The amount varies by building type with at least BUILDING_GOLD_MIN (2).

**Given** a player destroys a warehouse building
**When** the building HP reaches 0
**Then** doubloons should be spawned at the building's location
**And** the amount should be at least 2

```yaml
id: building_drops_doubloons
tags: [economy, pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  building: { type: warehouse, hp: 1 }

actions:
  - damageBuilding: { damage: 5 }

assertions:
  - doubloonDrop: ">= 2"
```

---

### Scenario: Death drops 20% of held doubloons

On death, a player drops DOUBLOON_DROP_RATIO (20%) of their doubloons as pickups. This creates meaningful risk without being punishing enough to cause rage-quits.

**Given** a player with 100 doubloons dies
**When** the death is processed
**Then** 20 doubloons should be dropped as pickups
**And** the player's doubloon count should be reduced by 20

```yaml
id: death_drops_20_percent
tags: [economy, pvp]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { doubloons: 100 }

actions:
  - killPlayer: {}

assertions:
  - droppedDoubloons: 20
  - player.doubloons: 80
```

---

### Scenario: Doubloon pickups have magnet and timeout

Dropped doubloons should magnetically attract toward nearby players (within DOUBLOON_MAGNET_RADIUS 90) and despawn after DOUBLOON_TIMEOUT (30 seconds) if uncollected.

**Given** a doubloon pickup on the map
**When** a player comes within 90 units
**Then** the doubloon should start moving toward the player
**When** 30 seconds pass without collection
**Then** the doubloon should despawn

```yaml
id: doubloon_magnet_and_timeout
tags: [economy]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  doubloon: { x: 100, y: 100, age: 0 }

actions:
  - playerApproach: { distance: 80 }

assertions:
  - doubloon.magnetActive: true

actions2:
  - advanceTime: 30

assertions2:
  - doubloon.despawned: true
```

---

### Scenario: PvP kill rewards doubloons from victim

When a player kills another player, the killer can pick up the victim's dropped doubloons (20% of victim's total). This creates a PvP economy loop.

**Given** player A kills player B who has 200 doubloons
**When** B dies and drops 40 doubloons
**And** A collects them
**Then** A's doubloon count should increase by 40

```yaml
id: pvp_kill_doubloon_transfer
tags: [economy, pvp]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  playerA: { doubloons: 50 }
  playerB: { doubloons: 200 }

actions:
  - killPlayer: { victim: B, killer: A }
  - collectDoubloons: { collector: A }

assertions:
  - playerA.doubloons: 90
  - playerB.doubloons: 160
```

---

### Scenario: Final score equals total doubloons earned

A player's round score should be their total accumulated doubloons at round end. This is the primary metric for leaderboard ranking.

**Given** a player with 450 doubloons at round end
**When** the round concludes and scores are tallied
**Then** the player's score should be 450

```yaml
id: score_equals_doubloons
tags: [economy, scoring]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { doubloons: 450 }

actions:
  - endRound: {}

assertions:
  - player.score: 450
```

---

### Scenario: Multiple income sources stack naturally

A player earning from passive income, NPC kills, and building raids should see all sources stack into their doubloon total without caps or diminishing returns.

**Given** in a 30-second window, a player earns:
  - 15 passive doubloons (0.5 × 30)
  - 15 doubloons from an NPC kill (3 + 6×2)
  - 8 doubloons from a building
**When** all awards are processed
**Then** total doubloons gained should be 38

```yaml
id: income_sources_stack
tags: [economy]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  player: { doubloons: 0 }

actions:
  - advanceTime: 30
  - killNpc: { upgradeCount: 6 }
  - destroyBuilding: { dropValue: 8 }

assertions:
  - player.doubloons: { approx: 38, tolerance: 3 }
```

---

### Scenario: Doubloon pickup radius is 28 units

Players automatically collect doubloons within DOUBLOON_PICKUP_RADIUS (28 units) without needing to click or interact.

**Given** a doubloon at position (100, 100)
**And** a player at position (120, 110) — distance ~22 units
**When** the tick processes pickups
**Then** the doubloon should be collected

```yaml
id: doubloon_pickup_radius
tags: [economy]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  doubloon: { x: 100, y: 100 }
  player: { x: 120, y: 110 }

actions:
  - tickPickups: {}

assertions:
  - doubloon.collected: true
```
