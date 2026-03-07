# NPC Combat Scenarios

> Core NPC engagement behaviors — spawning, AI, targeting, weapon fire, and rewards.
> These scenarios cover the existing implemented NPC system.

---

### Scenario: Weak NPCs spawn with reduced stats

Weak (sloop) archetype NPCs should be noticeably weaker than standard pirates — less HP, smaller size, lower mass — making them easy early-game targets that reward less.

**Given** the NPC director spawns an NPC with archetype roll in the weak range (0–30%)
**When** the NPC is created
**Then** its size, mass, and HP should be reduced relative to standard baseline
**And** its reward multiplier should be 0.7x

```yaml
id: npc_weak_archetype_stats
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  archetype: weak

actions:
  - spawnNpc: { archetype: weak }

assertions:
  - npc.sizeMul: 0.82
  - npc.massMul: 0.72
  - npc.hpMul: 0.68
  - npc.rewardMul: 0.7
```

---

### Scenario: Heavy NPCs have extra weapons and HP

Heavy (raider) archetype NPCs are significantly tougher with double HP, extra gunners, and a cannon — making them mid-game challenges worth engaging for higher rewards.

**Given** the NPC director spawns an NPC with archetype roll in the heavy range (70–90%)
**When** the NPC is created
**Then** it should have 2.1x HP, +2 gunners, +1 cannon per side
**And** its reward multiplier should be 1.35x

```yaml
id: npc_heavy_archetype_stats
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  archetype: heavy

actions:
  - spawnNpc: { archetype: heavy }

assertions:
  - npc.hpMul: 2.1
  - npc.extraGunners: 2
  - npc.extraCannonsPerSide: 1
  - npc.rewardMul: 1.35
```

---

### Scenario: Scavenger NPCs prioritize gold drops over players

Scavenger NPCs should chase nearby doubloon drops first, only targeting players when no gold is within their search radius. This creates emergent gameplay where scavengers race players for loot.

**Given** a scavenger NPC is alive
**And** a doubloon drop exists within 600 units of the scavenger
**When** the NPC AI evaluates targets
**Then** it should target the gold drop instead of the nearest player

```yaml
id: npc_scavenger_targets_gold
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  npcArchetype: scavenger
  goldDrop: { x: 100, y: 100, distanceFromNpc: 400 }
  player: { x: 200, y: 200, distanceFromNpc: 300 }

actions:
  - tickNpcAi: { npcId: scavenger_1 }

assertions:
  - npc.targetType: goldDrop
```

---

### Scenario: Hunter NPC targets the richest player

Heavy NPCs with the hunter personality should re-evaluate and target the player with the most doubloons, creating asymmetric threat that pressures leading players.

**Given** a hunter-personality NPC is alive
**And** player A has 500 doubloons and player B has 100 doubloons
**When** the NPC AI re-evaluates targets (every ~3 seconds)
**Then** it should target player A

```yaml
id: npc_hunter_targets_richest
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  npcPersonality: hunter
  playerA: { doubloons: 500 }
  playerB: { doubloons: 100 }

actions:
  - tickNpcAi: { npcId: hunter_1, forceReEval: true }

assertions:
  - npc.targetId: playerA
```

---

### Scenario: NPC reward scales with difficulty tier upgrades

As the round progresses, NPCs receive upgrades that make them tougher. Their doubloon rewards should scale proportionally, rewarding players for engaging harder enemies.

**Given** a standard NPC has received 5 difficulty-tier upgrades
**When** the player kills the NPC
**Then** the reward should be approximately 13 doubloons (base 3 + 5×2 = 13, ×1.0 standard, +0–3 random)

```yaml
id: npc_reward_scales_with_upgrades
tags: [pve, progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  npc:
    archetype: standard
    upgradeCount: 5

actions:
  - killNpc: { id: npc_target }

assertions:
  - reward.doubloons: ">= 10"
  - reward.doubloons: "<= 16"
```

---

### Scenario: NPC spawn rate accelerates over round time

The NPC spawn interval should decrease as the round progresses, from 3.5 seconds at the start to a floor of 1.5 seconds, creating escalating pressure.

**Given** the round has been running for 500 seconds
**When** the NPC director calculates the next spawn interval
**Then** the interval should be 1.5 seconds (the floor value)

```yaml
id: npc_spawn_rate_accelerates
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  roundTime: 500

actions:
  - calculateSpawnInterval: {}

assertions:
  - spawnInterval: 1.5
```

---

### Scenario: NPC spawn rate at round start is moderate

At the beginning of a round, NPCs should spawn infrequently to give players time to orient and choose their initial upgrades.

**Given** the round has just started (time = 0)
**When** the NPC director calculates the next spawn interval
**Then** the interval should be 3.5 seconds

```yaml
id: npc_spawn_rate_at_start
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  roundTime: 0

actions:
  - calculateSpawnInterval: {}

assertions:
  - spawnInterval: 3.5
```

---

### Scenario: NPC difficulty tier increases every 60 seconds

Each minute of round time should add one difficulty tier, giving all spawned NPCs an additional random standard upgrade.

**Given** the round has been running for 180 seconds
**When** a new NPC is spawned
**Then** it should receive 3 random standard upgrades (tier = floor(180/60) = 3)

```yaml
id: npc_difficulty_tier_per_minute
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  roundTime: 180

actions:
  - spawnNpc: {}

assertions:
  - npc.upgradeCount: 3
```

---

### Scenario: NPC AI transitions from approach to broadside

When an NPC gets close enough to a target, it should transition from direct approach to broadside positioning — turning perpendicular to present its weapon-bearing side.

**Given** an NPC in approach mode is within broadside engagement range of a player
**When** the NPC AI ticks
**Then** it should transition to broadside mode
**And** begin turning perpendicular to the target

```yaml
id: npc_ai_approach_to_broadside
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  npcAiState: approach
  npcDistanceToTarget: 100

actions:
  - tickNpcAi: { npcId: npc_1 }

assertions:
  - npc.aiState: broadside
```

---

### Scenario: NPC cap prevents excessive spawning

The server should never exceed 20 simultaneous NPCs, preventing performance degradation regardless of difficulty scaling.

**Given** 20 NPCs already exist in the simulation
**When** the NPC director attempts to spawn another NPC
**Then** the spawn should be suppressed
**And** the NPC count should remain at 20

```yaml
id: npc_cap_enforced
tags: [pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  existingNpcCount: 20

actions:
  - attemptSpawnNpc: {}

assertions:
  - npcCount: 20
  - spawnResult: suppressed
```
