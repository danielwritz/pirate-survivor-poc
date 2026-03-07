# Island Raid Scenarios

> Building destruction, tower defense, gold drops, and island capture loops.

---

### Scenario: Buildings have destructible HP

Each island building (hut, warehouse, fort, etc.) should have HP that can be reduced to 0 by player weapons, at which point the building is destroyed and drops doubloons.

**Given** a player is near an island with a building of type "hut" (HP 10)
**When** the player deals 10 damage to the building
**Then** the building should be destroyed
**And** it should drop doubloons

```yaml
id: building_destruction_basic
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  island: { id: test_island, buildings: [{ type: hut, hp: 10 }] }

actions:
  - damageBuilding: { buildingIndex: 0, damage: 10 }

assertions:
  - building.destroyed: true
  - doubloonDrop: ">= 1"
```

---

### Scenario: Building gold value varies by type

Different building types should yield different doubloon amounts: huts drop small amounts, warehouses drop moderate, forts drop large.

**Given** an island with one hut, one warehouse, and one fort
**When** all three buildings are destroyed
**Then** the fort should drop the most doubloons
**And** the warehouse should drop more than the hut

```yaml
id: building_gold_by_type
tags: [pve, economy]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  island:
    buildings:
      - { type: hut, hp: 10 }
      - { type: warehouse, hp: 30 }
      - { type: fort, hp: 50 }

actions:
  - destroyAll: {}

assertions:
  - drops.fort: ">= drops.warehouse"
  - drops.warehouse: ">= drops.hut"
  - drops.hut: ">= 1"
```

---

### Scenario: Tower fires at players within range

Island defense towers should automatically target and shoot at player ships that enter their range radius.

**Given** an island with an active tower (defense tier >= 1)
**And** a player ship within the tower's range
**When** the tower tick fires
**Then** a tower bullet should be spawned aimed at the player

```yaml
id: tower_fires_at_player
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  defenseLevel: 1
  island: { towers: [{ active: true, range: 300 }] }
  player: { x: 100, y: 100, withinRange: true }

actions:
  - tickTowers: {}

assertions:
  - towerBulletsFired: ">= 1"
```

---

### Scenario: Tower range and damage scale with defense tier

As the defense escalation timer ticks (every 90 seconds), towers should gain range and damage, making later raids significantly harder.

**Given** defense tier is 4 (at ~360 seconds)
**When** tower stats are calculated
**Then** range should be approximately 420 (300 + 4×30)
**And** damage should be approximately 12 (6 + 4×1.5)

```yaml
id: tower_scaling_with_defense_tier
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  defenseLevel: 4

actions:
  - calculateTowerStats: {}

assertions:
  - towerRange: { approx: 420, tolerance: 20 }
  - towerDamage: { approx: 12, tolerance: 2 }
```

---

### Scenario: Destroyed buildings do not respawn within a round

Once a building is destroyed, it stays destroyed for the remainder of the round. Islands become progressively stripped of value.

**Given** a building has been destroyed
**When** 120 seconds pass
**Then** the building should still be marked as destroyed
**And** it should not drop additional doubloons

```yaml
id: buildings_no_respawn
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  island: { buildings: [{ type: hut, destroyed: true }] }

actions:
  - advanceTime: 120

assertions:
  - building.destroyed: true
  - building.droppedThisTick: false
```

---

### Scenario: Players earn doubloons for destroying buildings

When a player's weapon (gun, cannon, or ram) destroys a building, the destroying player should receive the doubloon reward.

**Given** player A is attacking a building with 2 HP remaining
**When** player A deals 5 damage to the building
**Then** the building is destroyed
**And** player A's doubloon count increases by the building's drop value

```yaml
id: player_earns_building_doubloons
tags: [pve, economy]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { doubloons: 50 }
  building: { type: warehouse, hp: 2, dropValue: 15 }

actions:
  - damageBuilding: { source: player, damage: 5 }

assertions:
  - building.destroyed: true
  - player.doubloons: 65
```

---

### Scenario: Island has mixed building and tower layout

Each island should have a realistic mix of resource buildings (huts, warehouses) and defensive structures (towers, forts), creating risk-reward decisions for raiders.

**Given** an island is generated
**When** its layout is inspected
**Then** it should have at least 1 tower
**And** it should have at least 2 resource buildings
**And** total buildings should be between 3 and 8

```yaml
id: island_mixed_layout
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  island: { generated: true }

assertions:
  - island.towerCount: ">= 1"
  - island.resourceBuildingCount: ">= 2"
  - island.totalBuildings: ">= 3"
  - island.totalBuildings: "<= 8"
```

---

### Scenario: Ram damage applies to buildings on collision

When a player rams into an island building, ram damage should apply directly to the building, allowing aggressive close-range raids.

**Given** a player with ram damage 8 is sailing toward a building
**When** the player's hull collides with the building hitbox
**Then** the building should take 8 damage

```yaml
id: ram_damage_to_buildings
tags: [pve, combat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  player: { ramDamage: 8 }
  building: { hp: 20 }

actions:
  - ramBuilding: { source: player }

assertions:
  - building.hp: 12
```

---

### Scenario: Multiple players can raid the same island

Islands should support concurrent raiding — multiple players attacking different buildings simultaneously, competing for the loot.

**Given** two players are near the same island
**When** player A attacks building 0 and player B attacks building 1
**Then** both buildings take damage independently
**And** each player earns doubloons from their respective kills

```yaml
id: concurrent_island_raiding
tags: [pve, multiplayer]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  island: { buildings: [{ type: hut, hp: 5 }, { type: warehouse, hp: 10 }] }
  players: [{ id: A }, { id: B }]

actions:
  - damageBuilding: { source: A, buildingIndex: 0, damage: 5 }
  - damageBuilding: { source: B, buildingIndex: 1, damage: 10 }

assertions:
  - buildings[0].destroyed: true
  - buildings[1].destroyed: true
  - playerA.doubloonDelta: ">= 1"
  - playerB.doubloonDelta: ">= 1"
```

---

### Scenario: Fully raided island yields no further rewards

Once all buildings on an island are destroyed, the island should be visually "swept" and offer no further doubloon income, pushing players to seek other islands or fight NPCs/bosses.

**Given** an island with all buildings already destroyed
**When** a player arrives at the island
**Then** there should be no interactable buildings
**And** no doubloon drops should occur

```yaml
id: fully_raided_island_empty
tags: [pve, economy]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  island: { buildings: [{ destroyed: true }, { destroyed: true }, { destroyed: true }] }

actions:
  - playerArrivesAt: { island: true }

assertions:
  - interactableBuildings: 0
  - doubloonDrops: 0
```
