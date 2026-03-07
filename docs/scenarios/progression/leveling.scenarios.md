# Leveling Scenarios

> XP curve, level-up triggers, passive doubloon income, and level progression pacing.

---

### Scenario: First level costs 8 XP

A fresh ship starts at level 1 with xpToNext = 8 (XP_START). The first level-up should feel almost immediate, giving the player a quick taste of progression.

**Given** a newly spawned ship at level 1 with xp 0, xpToNext 8
**When** the ship earns 8 XP
**Then** the ship should level up to level 2
**And** xpToNext should increase to floor(8 × 1.18 + 3) = 12

```yaml
id: first_level_costs_8
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { level: 1, xp: 0, xpToNext: 8 }

actions:
  - awardXp: { amount: 8 }

assertions:
  - ship.level: 2
  - ship.xpToNext: 12
```

---

### Scenario: XP curve escalates with formula XP_SCALE × prev + XP_ADD

Each level costs progressively more XP: floor(prev × 1.18 + 3). This should produce a curve where early levels are fast and later levels are slower but not punishing.

**Given** a ship at level 5 with xpToNext calculated from the formula
**When** the accumulated cost to reach level 10 is calculated
**Then** it should require significantly more total XP than levels 1–5

```yaml
id: xp_curve_escalation
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { level: 1, xp: 0, xpToNext: 8 }

actions:
  - levelUpTo: 10

assertions:
  - totalXpToLevel5: { approx: 55, tolerance: 5 }
  - totalXpToLevel10: { approx: 155, tolerance: 15 }
```

---

### Scenario: Level-up grants +0.6 size, +2 maxHp, +4 heal

Every level-up should make the ship tangibly larger and tougher, reinforcing the power fantasy. The +4 heal is a small burst heal on level-up.

**Given** a ship at level 3 with size 17.2, maxHp 24, hp 20
**When** the ship levels up
**Then** size should increase by 0.6
**And** maxHp should increase by 2
**And** hp should increase by 4 (capped at maxHp)

```yaml
id: levelup_stat_growth
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { level: 3, size: 17.2, maxHp: 24, hp: 20, xp: 0, xpToNext: 1 }

actions:
  - awardXp: { amount: 1 }

assertions:
  - ship.level: 4
  - ship.size: { approx: 17.8, tolerance: 0.1 }
  - ship.maxHp: 26
  - ship.hp: 24
```

---

### Scenario: Level-up heal does not exceed maxHp

The +4 HP burst on level-up should be capped at maxHp — it's a convenience heal, not an overheal.

**Given** a ship at maxHp 24, hp 23
**When** the ship levels up (maxHp becomes 26)
**Then** hp should be min(23 + 4, 26) = 26

```yaml
id: levelup_heal_capped
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { maxHp: 24, hp: 23, xp: 0, xpToNext: 1, level: 5, size: 19 }

actions:
  - awardXp: { amount: 1 }

assertions:
  - ship.maxHp: 26
  - ship.hp: 26
```

---

### Scenario: Passive doubloon income for staying alive

Players earn 0.5 doubloons/second just for surviving. This ensures even cautious players level up and contribute to the power fantasy without requiring constant combat.

**Given** a ship that is alive
**When** 10 seconds of game time pass
**Then** the ship should earn approximately 5 passive doubloons

```yaml
id: passive_doubloon_income
tags: [progression, economy]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { alive: true, doubloons: 0 }
  passiveRate: 0.5

actions:
  - advanceTime: 10

assertions:
  - ship.doubloons: { approx: 5, tolerance: 1 }
```

---

### Scenario: Multi-level-up from large XP award

If a single XP award is large enough to cross multiple level thresholds, all level-ups should be processed in the same tick. Each level-up accumulates stat bonuses and queues upgrade offers.

**Given** a level 1 ship with xpToNext 8
**When** 100 XP is awarded at once
**Then** the ship should level up multiple times in a single call
**And** all stat bonuses should be applied cumulatively

```yaml
id: multi_levelup_single_award
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { level: 1, xp: 0, xpToNext: 8, size: 16, maxHp: 20 }

actions:
  - awardXp: { amount: 100 }

assertions:
  - ship.level: ">= 6"
  - ship.size: ">= 19"
  - ship.maxHp: ">= 30"
```

---

### Scenario: XP awarded from NPC kills

Killing an NPC should award XP equal to its doubloon reward value (base 3 + 2 per upgrade on the NPC). This ties combat rewards directly to leveling.

**Given** a player ship kills an NPC with 4 upgrades
**When** the NPC death is processed
**Then** the player earns 11 doubloons (3 + 4×2) as XP toward their next level

```yaml
id: xp_from_npc_kills
tags: [progression, pve]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { xp: 0, xpToNext: 15, level: 2 }
  npc: { upgradeCount: 4 }

actions:
  - killNpc: { killer: player }

assertions:
  - player.xpGained: 11
```

---

### Scenario: Expected level at key round timestamps

Players should reach roughly predictable levels at key moments to support the difficulty and upgrade pacing design.

**Given** a reasonably active player (70% combat uptime)
**When** 2 minutes have elapsed (Calm Waters → Contested Seas)
**Then** the player should be approximately level 4–6
**When** 5 minutes have elapsed (Contested Seas → War Zone)
**Then** the player should be approximately level 10–14
**When** 8 minutes have elapsed (War Zone → Kraken Frontier)
**Then** the player should be approximately level 16–20

```yaml
id: expected_level_pacing
tags: [progression, balance]
status: pending
sprint: v0.7
priority: p1

setup:
  player: { combatUptime: 0.7 }

actions:
  - simulateRound: { checkpoints: [120, 300, 480] }

assertions:
  - levelAt120s: { approx: 5, tolerance: 2 }
  - levelAt300s: { approx: 12, tolerance: 3 }
  - levelAt480s: { approx: 18, tolerance: 3 }
```
