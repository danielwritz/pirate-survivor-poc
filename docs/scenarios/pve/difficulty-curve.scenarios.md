# Difficulty Curve Scenarios

> NPC tier progression, spawn rate escalation, tower defense scaling, and named stage transitions.

---

### Scenario: Difficulty tier 0 at round start

At the start of a round, NPCs should spawn at their base power level with no additional upgrades.

**Given** the round has just started (time = 0)
**When** a new NPC is spawned
**Then** it should have 0 upgrades applied (difficulty tier 0)

```yaml
id: difficulty_tier_zero_at_start
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  roundTime: 0

actions:
  - spawnNpc: {}

assertions:
  - npc.upgradeCount: 0
```

---

### Scenario: Difficulty tier reaches maximum at round end

By the end of a 10-minute round, NPCs should be at tier 10 with 10 random upgrades each, representing maximum NPC power.

**Given** the round has been running for 600 seconds
**When** a new NPC is spawned
**Then** it should have 10 upgrades applied

```yaml
id: difficulty_tier_max_at_end
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  roundTime: 600

actions:
  - spawnNpc: {}

assertions:
  - npc.upgradeCount: 10
```

---

### Scenario: Tower defenses escalate every 90 seconds

Island tower defenses should become progressively more dangerous, turning safe-to-raid islands into threatening fortifications over the course of a round.

**Given** the round has been running for 270 seconds (3 escalation ticks)
**When** the defense tier is calculated
**Then** defense level should be 3
**And** towers should have increased range and damage compared to tier 0

```yaml
id: tower_defense_escalation
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  roundTime: 270

actions:
  - updateDefenseTier: {}

assertions:
  - defenseLevel: 3
  - towerRange: ">= 360"
  - towerDamage: ">= 9"
```

---

### Scenario: Towers do not fire during Calm Waters stage

During the first 2 minutes (Calm Waters), towers should not fire at all, giving players a safe window to raid islands for early doubloons.

**Given** the round time is 60 seconds (within Calm Waters)
**And** a player is within tower range
**When** the tower tick runs
**Then** no tower bullets should be spawned

```yaml
id: towers_inactive_during_calm_waters
tags: [pve]
status: pending
sprint: v0.7
priority: p1

setup:
  roundTime: 60
  defenseLevel: 0
  playerInTowerRange: true

actions:
  - tickTowers: {}

assertions:
  - towerBulletsFired: 0
```

---

### Scenario: Stage transition from Calm Waters to Contested Seas

At the 2-minute mark, the game should transition from Calm Waters to Contested Seas, introducing standard and heavy NPCs and activating tower defenses.

**Given** the round time is about to cross 120 seconds
**When** the round time reaches 120 seconds
**Then** the stage should change to "Contested Seas"
**And** a stage transition event should be broadcast to all clients
**And** heavy NPC archetype should become eligible for spawning

```yaml
id: stage_transition_calm_to_contested
tags: [pve]
status: pending
sprint: v0.7
priority: p0

setup:
  roundTime: 119

actions:
  - advanceTime: 2

assertions:
  - currentStage: contested_seas
  - event.stageTransition: { stage: contested_seas }
  - npcArchetypesAvailable: { contains: heavy }
```

---

### Scenario: Stage transition from Contested Seas to War Zone

At the 5-minute mark, difficulty shifts to War Zone with maximum NPC variety and aggressive spawning.

**Given** the round time is about to cross 300 seconds
**When** the round time reaches 300 seconds
**Then** the stage should change to "War Zone"
**And** scavenger NPCs should become eligible for spawning

```yaml
id: stage_transition_contested_to_warzone
tags: [pve]
status: pending
sprint: v0.7
priority: p0

setup:
  roundTime: 299

actions:
  - advanceTime: 2

assertions:
  - currentStage: war_zone
  - event.stageTransition: { stage: war_zone }
  - npcArchetypesAvailable: { contains: scavenger }
```

---

### Scenario: Stage transition from War Zone to Kraken Frontier

At the 8-minute mark, the final stage begins with maximum pressure and the Kraken boss becoming eligible.

**Given** the round time is about to cross 480 seconds
**When** the round time reaches 480 seconds
**Then** the stage should change to "Kraken Frontier"
**And** a Kraken boss should become eligible for spawning

```yaml
id: stage_transition_warzone_to_kraken
tags: [pve]
status: pending
sprint: v0.7
priority: p0

setup:
  roundTime: 479

actions:
  - advanceTime: 2

assertions:
  - currentStage: kraken_frontier
  - event.stageTransition: { stage: kraken_frontier }
  - bossArchetypesAvailable: { contains: kraken }
```

---

### Scenario: NPC archetype distribution changes with stage

During Calm Waters, only weak NPCs should spawn. As stages progress, the full archetype pool opens up.

**Given** the stage is "Calm Waters" (0:00–2:00)
**When** NPCs are spawned during this stage
**Then** only weak archetype NPCs should be eligible

```yaml
id: calm_waters_weak_npcs_only
tags: [pve]
status: pending
sprint: v0.7
priority: p1

setup:
  currentStage: calm_waters

actions:
  - spawnNpc: {}

assertions:
  - npc.archetype: weak
```

---

### Scenario: Late-game NPC power creates genuine threat

By minute 8+, NPC enemies with 8+ random upgrades should be genuinely dangerous to even well-upgraded player ships, creating tension in the climax phase.

**Given** the round time is 500 seconds (tier 8)
**When** a heavy NPC is spawned with 8 upgrades
**Then** its effective HP should be at least 80 (base×2.1 + upgrade bonuses)
**And** its damage output should be higher than a tier-0 heavy

```yaml
id: late_game_npcs_are_threatening
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  roundTime: 500
  archetype: heavy

actions:
  - spawnNpc: { archetype: heavy }

assertions:
  - npc.maxHp: ">= 80"
  - npc.upgradeCount: 8
```
