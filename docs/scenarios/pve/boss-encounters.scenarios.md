# Boss Encounter Scenarios

> Boss spawning, fighting, rewards, and multi-player dynamics.
> **STATUS: All scenarios are `pending` — boss system is not yet implemented.**

---

### Scenario: First boss spawns at difficulty tier 2

The first boss should appear around the 2:30 mark when players have had time to choose initial upgrades and establish a build direction but before they feel comfortable.

**Given** the round time reaches the tier-2 boss threshold (~150 seconds)
**And** no boss is currently alive
**When** the boss spawn timer triggers
**Then** a War Galleon boss should spawn at the farthest point from all players
**And** a boss spawn announcement should be broadcast to all clients

```yaml
id: boss_first_spawn_at_tier_2
tags: [pve]
status: pending
sprint: v0.7
priority: p0

setup:
  roundTime: 150
  activeBossCount: 0
  playerCount: 4

actions:
  - advanceTime: 5

assertions:
  - boss.alive: true
  - boss.archetype: war_galleon
  - event.bossSpawn: true
  - boss.spawnDistance: { min: "farthestFromPlayers" }
```

---

### Scenario: Boss HP scales with tier and player count

Boss encounters should be balanced for the number of active players — solo players face a tractable boss, while full lobbies face a tougher one.

**Given** a boss is being spawned at tier 4 with 6 active players
**When** the boss stats are calculated
**Then** HP should be 260 + 18×4 + 45×16 = 1052, adjusted for player count (+0.6 per player = ×3.6 bonus)

```yaml
id: boss_hp_scales_with_tier_and_players
tags: [pve]
status: pending
sprint: v0.7
priority: p0

setup:
  bossTier: 4
  playerCount: 6

actions:
  - spawnBoss: { tier: 4 }

assertions:
  - boss.maxHp: ">= 900"
  - boss.maxHp: "<= 1200"
  - boss.size: ">= 35"
```

---

### Scenario: War Galleon has devastating broadside pattern

The War Galleon boss should telegraph its broadside volley, then fire a concentrated barrage. Players who read the telegraph and maneuver out of the firing arc should avoid most damage.

**Given** a War Galleon boss is alive and in broadside mode
**And** a player is within its cannon arc
**When** the War Galleon fires its broadside
**Then** multiple heavy cannonballs should be spawned
**And** total potential damage should be significantly higher than a regular NPC volley

```yaml
id: boss_war_galleon_broadside
tags: [pve]
status: pending
sprint: v0.7
priority: p0

setup:
  boss:
    archetype: war_galleon
    aiState: broadside
  player:
    inBossCannonArc: true

actions:
  - tickBossAi: { bossId: boss_1 }
  - advanceTicks: 1

assertions:
  - bullets.heavy.count: ">= 4"
  - bullets.totalPotentialDamage: ">= 30"
```

---

### Scenario: Fire Ship boss rams and ignites on contact

The Fire Ship boss should aggressively pursue the nearest player and ignite them on contact, creating a positioning check that punishes stationary or slow builds.

**Given** a Fire Ship boss is alive
**And** it collides with a player ship
**When** the collision is resolved
**Then** the player should take ram damage
**And** the player should be set on fire

```yaml
id: boss_fire_ship_ram_ignite
tags: [pve]
status: pending
sprint: v0.7
priority: p0

setup:
  boss:
    archetype: fire_ship
    speed: 3.5
  player:
    hp: 50
    onFire: false

actions:
  - collideShips: { attacker: boss_1, defender: player }

assertions:
  - player.hp: "< 50"
  - player.onFire: true
```

---

### Scenario: Kraken boss has area-denial attack

The Kraken boss (late-game) should threaten a large area around itself, testing sustained DPS and forcing players to manage positioning carefully over a longer fight.

**Given** a Kraken boss is alive at tier 8
**When** the Kraken activates its area-denial ability
**Then** all ships within a radius should take periodic damage
**And** the radius should be visible to players (broadcast as an event)

```yaml
id: boss_kraken_area_denial
tags: [pve]
status: pending
sprint: v0.7
priority: p1

setup:
  boss:
    archetype: kraken
    tier: 8

actions:
  - tickBossAi: { bossId: kraken_1 }

assertions:
  - boss.areaEffect.active: true
  - boss.areaEffect.radius: ">= 150"
  - event.areaDenial: true
```

---

### Scenario: Boss kill drops large doubloon reward

Killing a boss should be one of the most rewarding actions in the game, providing a large doubloon cache that directly accelerates progression.

**Given** a boss at tier 4 is alive
**When** the player kills the boss
**Then** doubloon drops should total approximately 90 (50 + 10×4)
**And** the killing player receives a major upgrade offer

```yaml
id: boss_kill_reward
tags: [pve, progression]
status: pending
sprint: v0.7
priority: p0

setup:
  boss:
    tier: 4
    hp: 1

actions:
  - applyDamage: { target: boss_1, amount: 5 }

assertions:
  - boss.alive: false
  - reward.doubloons: ">= 80"
  - reward.doubloons: "<= 100"
  - killingPlayer.majorOfferTriggered: true
```

---

### Scenario: Nearby players receive splash doubloons from boss kill

In multiplayer, players near a boss kill should receive a smaller share of doubloons even if they didn't land the killing blow — rewarding participation without eliminating the incentive to compete for the kill.

**Given** a boss is killed by player A
**And** player B is within 300 units of the boss death location
**And** player C is 800 units away
**When** the boss reward is distributed
**Then** player A receives the full reward + major upgrade offer
**And** player B receives 30% of the base reward as splash
**And** player C receives nothing (out of splash range)

```yaml
id: boss_kill_splash_reward
tags: [pve, pvp]
status: pending
sprint: v0.7
priority: p1

setup:
  boss:
    tier: 4
    hp: 1
  playerA: { distanceToBoss: 50 }
  playerB: { distanceToBoss: 250 }
  playerC: { distanceToBoss: 800 }

actions:
  - applyDamage: { target: boss_1, amount: 5, source: playerA }

assertions:
  - playerA.rewardDoubloons: ">= 80"
  - playerA.majorOfferTriggered: true
  - playerB.rewardDoubloons: ">= 20"
  - playerB.rewardDoubloons: "<= 35"
  - playerC.rewardDoubloons: 0
```

---

### Scenario: Only one boss alive at a time

The server should prevent multiple bosses from existing simultaneously to avoid overwhelming players and to make each boss encounter feel like a distinct event.

**Given** a boss is currently alive
**When** the boss spawn timer triggers
**Then** no new boss should spawn
**And** the spawn should be deferred until the current boss is defeated

```yaml
id: boss_single_instance_limit
tags: [pve]
status: pending
sprint: v0.7
priority: p0

setup:
  activeBossCount: 1

actions:
  - attemptBossSpawn: {}

assertions:
  - activeBossCount: 1
  - spawnResult: deferred
```

---

### Scenario: Boss spawn announced with directional indicator

When a boss spawns, all players should receive a clear notification including the direction to the boss, creating a decision point (engage or avoid).

**Given** a boss spawns at coordinates (2500, 1800)
**And** the player is at (500, 500)
**When** the boss spawn event is broadcast
**Then** the client should display a directional indicator pointing toward the boss
**And** a boss spawn audio cue should play

```yaml
id: boss_spawn_announcement
tags: [pve, visual, audio]
status: pending
sprint: v0.7
priority: p1

setup:
  bossSpawnPosition: { x: 2500, y: 1800 }
  playerPosition: { x: 500, y: 500 }

actions:
  - spawnBoss: { tier: 3 }

assertions:
  - event.bossSpawn: true
  - event.bossSpawn.position: { x: 2500, y: 1800 }
  - client.directionalIndicator: { visible: true, targetType: boss }
  - client.audioEvent: bossSpawn
```

---

### Scenario: Expected 3-4 bosses per full round

Over a complete 10-minute round, the boss spawn cadence should produce approximately 3-4 boss encounters, pacing the round with milestone moments.

**Given** a full 10-minute round plays out
**And** each boss is killed within 60 seconds of spawning
**When** the round ends
**Then** 3-4 total bosses should have spawned

```yaml
id: boss_cadence_per_round
tags: [pve]
status: pending
sprint: v0.7
priority: p1

setup:
  roundDuration: 600
  bossKillTime: 60

actions:
  - simulateFullRound: {}

assertions:
  - totalBossesSpawned: ">= 3"
  - totalBossesSpawned: "<= 4"
```
