# Scenario Format Specification

> This document defines the **hybrid scenario format** used across all `docs/scenarios/` files.
> It is the contract between **design** (what implementing agents build toward) and **testing** (what verification agents assert against).

---

## Purpose

Scenarios describe **observable behaviors** of the game — things a player experiences or a system guarantees. They serve three audiences:

1. **Implementing agents** read the plain-language description + setup/actions to understand *what to build*.
2. **Testing agents** read the structured execution block to write *deterministic automated assertions*.
3. **Reviewing agents** compare PR diffs against related scenarios to verify *nothing regresses*.

Implementing agents see the full scenario but do **not** know the test mechanism (unit test, integration test, E2E harness). Testing agents decide the mechanism.

---

## Scenario Structure

Each scenario has two parts: a **narrative header** and a **structured execution block**.

### Narrative Header

```markdown
### Scenario: <short descriptive title>

<1–3 sentence plain-language description of the behavior.
Written from the player's or system's perspective.
Should be understandable by a non-programmer.>

**Given** <precondition — the world state before the action>
**When** <trigger — what the player does or what the system does>
**Then** <outcome — the observable result>
**And** <additional outcomes, if any>
```

### Structured Execution Block

Immediately follows the narrative header, fenced in a YAML code block:

```yaml
id: <unique_snake_case_identifier>
tags: [<tag>, ...]
status: <pending | active | passing>
sprint: <version that introduced this scenario, e.g. v0.7>
priority: <p0 | p1 | p2>

setup:
  <key>: <value>
  # Describe initial state. Keys are domain-specific.
  # Examples: roundTime, playerLevel, npcCount, shipHp, upgradePool

actions:
  - <verb>: <parameters>
  # Ordered list of things that happen.
  # Examples: spawnBoss, applyDamage, selectUpgrade, advanceTime

assertions:
  - <property>: <expected_value>
  # Unordered list of post-action expectations.
  # Each assertion is independently verifiable.
  # Examples: ship.alive: true, boss.hp: 0, player.doubloons: ">= 50"
```

---

## Field Reference

### Top-level fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier across all scenario files. Snake_case. Globally unique. |
| `tags` | Yes | Categorization. At least one of: `pve`, `pvp`, `progression`, `multiplayer`, `regression`, `visual`, `audio`. |
| `status` | Yes | `pending` = designed, not yet implemented. `active` = in current sprint. `passing` = verified green. |
| `sprint` | Yes | Version that introduced or will introduce this scenario (e.g., `v0.7`, `v0.6-existing`). |
| `priority` | Yes | `p0` = blocks release, `p1` = should ship, `p2` = nice to have. |

### Setup

Free-form key/value pairs describing initial state. The testing agent interprets these to construct test fixtures. Common keys:

| Key | Example | Meaning |
|-----|---------|---------|
| `roundTime` | `300` | Seconds into the round |
| `playerLevel` | `10` | Player's current level |
| `playerShip` | `{ hp: 20, maxHp: 20, cannons: 2 }` | Ship state overrides |
| `npcArchetype` | `heavy` | NPC type to spawn |
| `wind` | `{ angle: 0, strength: 0.3 }` | Wind state |
| `upgradePool` | `[crew-musketeers, cannons]` | Available upgrades |

### Actions

Ordered list of domain verbs. Each action is a single key-value pair. Common verbs:

| Verb | Example | Meaning |
|------|---------|---------|
| `advanceTime` | `60` | Advance simulation by N seconds |
| `advanceTicks` | `100` | Advance simulation by N ticks |
| `spawnNpc` | `{ archetype: heavy }` | Spawn a specific NPC |
| `spawnBoss` | `{ tier: 2 }` | Spawn a boss at a difficulty tier |
| `applyDamage` | `{ target: player, amount: 10, heavy: true }` | Deal damage |
| `fireCannonAt` | `{ angle: 1.57 }` | Player fires cannon at angle |
| `selectUpgrade` | `{ index: 0 }` | Player picks first upgrade offer |
| `killNpc` | `{ id: npc_1 }` | Kill a specific NPC |
| `collectDoubloons` | `{ amount: 50 }` | Player picks up doubloons |
| `playerDeath` | `{}` | Player dies |
| `playerRespawn` | `{}` | Player respawns |
| `submitVote` | `{ category: enemyDensity, choice: more }` | Cast a round vote |

### Assertions

Unordered list. Each assertion is a property path and expected value. Comparison operators:

| Operator | Example | Meaning |
|----------|---------|---------|
| exact | `ship.alive: true` | Strict equality |
| `">= N"` | `player.doubloons: ">= 50"` | Greater than or equal |
| `"<= N"` | `boss.hp: "<= 0"` | Less than or equal |
| `"> N"` | `npcCount: "> 5"` | Strictly greater |
| `"< N"` | `spawnInterval: "< 2.0"` | Strictly less |
| `contains` | `player.upgrades: { contains: cannons }` | Array includes value |
| `not` | `player.onFire: { not: true }` | Negation |
| `approx` | `ship.speed: { approx: 2.6, tolerance: 0.1 }` | Approximate equality |

---

## Tags

| Tag | Use for |
|-----|---------|
| `pve` | NPC combat, boss encounters, island raids, tower defenses |
| `pvp` | Player-vs-player combat, doubloon theft, death/respawn |
| `progression` | XP, leveling, upgrades, ship growth, economy |
| `multiplayer` | Round lifecycle, voting, spectator, leaderboard, chat |
| `regression` | Cross-cutting scenarios that must always pass |
| `visual` | Rendering, VFX, HUD elements |
| `audio` | Sound effects, spatial audio |

---

## Status Lifecycle

```
pending ──(sprint starts)──► active ──(tests pass)──► passing
                                │
                                └──(sprint complete, not yet green)──► stays active
```

- **pending**: Scenario is designed. No code implements it yet. Used for future sprints.
- **active**: Scenario is part of the current sprint. Implementing and testing agents work against it.
- **passing**: Tests exist and pass. Scenario is part of the regression suite.

Scenarios with status `passing` from a previous sprint **must continue to pass** on every future sprint. This is enforced during the main-branch merge regression run.

---

## File Organization

```
docs/scenarios/
  pve/
    npc-combat.scenarios.md
    boss-encounters.scenarios.md
    difficulty-curve.scenarios.md
    island-raids.scenarios.md
  progression/
    leveling.scenarios.md
    upgrades.scenarios.md
    ship-growth.scenarios.md
    economy.scenarios.md
  pvp/
    player-combat.scenarios.md
    death-respawn.scenarios.md
  multiplayer/
    round-lifecycle.scenarios.md
    voting.scenarios.md
    spectator.scenarios.md
    leaderboard.scenarios.md
    chat.scenarios.md
  meta/
    regression.scenarios.md
```

Each file contains multiple scenarios grouped by theme. Scenarios within a file share context but are independently testable.

---

## Full Example

### Scenario: Heavy NPC drops scaled doubloon reward

A heavy-archetype NPC that has received 3 difficulty-tier upgrades should drop significantly more doubloons than a base weak NPC, rewarding players for engaging tougher enemies.

**Given** a heavy NPC with 3 applied upgrades is alive
**When** the player kills the heavy NPC
**Then** the doubloon reward should be approximately 11–14 (base 3 + 3×2 upgrades, ×1.35 heavy multiplier, +0–3 random)
**And** doubloon drops appear at the NPC's death location

```yaml
id: heavy_npc_scaled_reward
tags: [pve, progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  npc:
    archetype: heavy
    upgradeCount: 3

actions:
  - killNpc: { id: npc_target }

assertions:
  - reward.doubloons: ">= 10"
  - reward.doubloons: "<= 15"
  - reward.dropLocation: { near: npc_target.deathPosition, radius: 50 }
```

---

### Scenario: Manual lane override persists

Given a board item classified as "Informational"
When the user moves it to "Requires Action"
Then the board should display the item in "Requires Action"
And subsequent board loads should keep the item in that lane.

```yaml
id: manual_lane_override_persists

setup:
  lane: informational

actions:
  - move_to_lane: requires_action

assertions:
  - lane: requires_action
  - override_persisted: true
```

> Note: The above is the user's reference example for the structured block format. Actual game scenarios follow the domain verbs defined in this spec.

---

## Conventions

1. **One scenario = one behavior.** Don't test multiple unrelated things in one scenario.
2. **Setup should be minimal.** Only specify state that differs from defaults.
3. **Actions should be sequential.** Order matters. Each action can depend on the result of the previous one.
4. **Assertions should be independent.** Each assertion is separately verifiable. If one fails, others can still be checked.
5. **IDs are globally unique.** Use the pattern `<domain>_<behavior>` (e.g., `boss_spawn_at_tier_threshold`, `pvp_doubloon_drop_on_death`).
6. **Scenarios for existing behavior** use `sprint: v0.6-existing` and `status: passing`. These form the initial regression baseline.
