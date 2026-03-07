# Death & Respawn Scenarios

> Death consequences, doubloon drops, respawn invulnerability, and comeback mechanics.

---

### Scenario: Player drops 20% of doubloons on death

When a player dies, DOUBLOON_DROP_RATIO (20%) of their doubloons are dropped as pickups at the death location. The remaining 80% is retained.

**Given** a player with 150 doubloons
**When** the player's HP reaches 0
**Then** 30 doubloons should be spawned as pickups
**And** the player retains 120 doubloons

```yaml
id: death_drops_20_percent_doubloons
tags: [pvp, economy]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { doubloons: 150, hp: 0 }

actions:
  - processDeath: {}

assertions:
  - droppedDoubloons: 30
  - player.doubloons: 120
```

---

### Scenario: Dropped doubloons are collectible by any player

Death-dropped doubloons should be free-for-all pickups — the killer, allies, or bystanders can all collect them.

**Given** player A kills player B who drops 40 doubloons
**When** player C (a bystander) sails over the dropped doubloons
**Then** player C should collect them

```yaml
id: death_drops_free_for_all
tags: [pvp, economy]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  playerB: { doubloons: 200, hp: 0 }
  playerC: { doubloons: 10 }

actions:
  - processDeath: { victim: B }
  - movePlayer: { player: C, toDropLocation: true }
  - tickPickups: {}

assertions:
  - playerC.doubloons: ">= 50"
```

---

### Scenario: Respawn with invulnerability window

After death, the player respawns with RESPAWN_INVULN (2.0 seconds) of invulnerability, preventing spawn-camping.

**Given** a player has just respawned
**When** another player shoots them within 1 second
**Then** no damage should be applied

```yaml
id: respawn_invulnerability
tags: [pvp]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { justRespawned: true, invulnTimer: 2.0 }

actions:
  - dealDamage: { amount: 15, target: player }

assertions:
  - player.damageTaken: 0
```

---

### Scenario: Invulnerability expires after 2 seconds

The respawn shield wears off after exactly RESPAWN_INVULN seconds. After that, the player is vulnerable.

**Given** a player respawned 2.1 seconds ago
**When** they take a hit
**Then** full damage should be applied

```yaml
id: invuln_expires_after_2s
tags: [pvp]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { respawnTime: 2.1, invulnTimer: 0 }

actions:
  - dealDamage: { amount: 10, target: player }

assertions:
  - player.damageTaken: 10
```

---

### Scenario: Player retains level and upgrades on death

Death should NOT reset level, upgrades, size, or any accumulated power. Only doubloons are penalized. This preserves the power fantasy even through deaths.

**Given** a level 12 player with 8 upgrades dies
**When** the player respawns
**Then** level should still be 12
**And** all 8 upgrades should still be applied
**And** ship size should be unchanged

```yaml
id: retains_level_and_upgrades_on_death
tags: [pvp, progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { level: 12, upgradeCount: 8, size: 22.6 }

actions:
  - processDeath: {}
  - respawn: {}

assertions:
  - player.level: 12
  - player.upgradeCount: 8
  - player.size: 22.6
```

---

### Scenario: Respawn location is safe distance from killer

When respawning, the player should be placed at a safe distance from the player who killed them to prevent immediate re-engagement.

**Given** player A was killed by player B at position (500, 500)
**When** player A respawns
**Then** the spawn location should be at least 400 units from player B's position

```yaml
id: safe_respawn_distance
tags: [pvp]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  killer: { x: 500, y: 500 }

actions:
  - respawn: { victim: A }

assertions:
  - distanceFromKiller: ">= 400"
```

---

### Scenario: Death with 0 doubloons drops nothing

If a player dies with 0 doubloons (e.g., they just respawned and were immediately killed again), no pickups should be generated.

**Given** a player with 0 doubloons
**When** they die
**Then** no doubloon pickups should be spawned

```yaml
id: zero_doubloon_death_no_drops
tags: [pvp, economy]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  player: { doubloons: 0 }

actions:
  - processDeath: {}

assertions:
  - droppedDoubloons: 0
```

---

### Scenario: Kill credit goes to last damaging player

When a player dies, the kill should be credited to the last player who dealt damage (within a reasonable window), not the player who technically got the last hit if it was fire or environmental.

**Given** player A has been shooting player B
**And** player B catches fire and dies from fire damage
**When** the death is processed
**Then** player A should receive kill credit

```yaml
id: kill_credit_last_attacker
tags: [pvp, scoring]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  playerB: { hp: 1, lastAttacker: A, onFire: true }

actions:
  - tickFire: {}  # fire finishes them off

assertions:
  - playerB.alive: false
  - killCredit: A
```
