# Round Lifecycle Scenarios

> Round start, 10-minute timer, end conditions, scoring, and state transitions.

---

### Scenario: Round lasts exactly 10 minutes

A round runs for ROUND_DURATION (600 seconds). The server tick counter drives this clock authoritatively.

**Given** a round has started at tick 0
**When** 12,000 ticks have elapsed (600s × 20 ticks/s)
**Then** the round should end
**And** results should be calculated

```yaml
id: round_duration_10_minutes
tags: [multiplayer]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  round: { startTick: 0 }

actions:
  - advanceTicks: 12000

assertions:
  - round.ended: true
  - round.duration: 600
```

---

### Scenario: Server ticks at 20 Hz

The server simulation runs at TICK_RATE (20) ticks per second. Each tick processes physics, combat, spawning, and state sync.

**Given** the server is running a round
**When** 1 real second passes
**Then** approximately 20 simulation ticks should have executed

```yaml
id: server_tick_rate_20hz
tags: [multiplayer]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  server: { running: true }

assertions:
  - tickRate: 20
  - tickInterval: 0.05
```

---

### Scenario: Round ends and scores are sent to all clients

When the round timer expires, the server should broadcast final scores and standings to all connected clients.

**Given** 3 players in a round that is about to end
**When** the round timer reaches 600 seconds
**Then** all 3 clients should receive a roundEnd message
**And** the message should contain sorted player scores

```yaml
id: round_end_broadcasts_scores
tags: [multiplayer, scoring]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  players: [{ id: A, doubloons: 300 }, { id: B, doubloons: 500 }, { id: C, doubloons: 150 }]
  roundTime: 599

actions:
  - advanceTime: 2

assertions:
  - broadcastSent: roundEnd
  - scores[0].id: B
  - scores[1].id: A
  - scores[2].id: C
```

---

### Scenario: Player can join mid-round

Players should be able to join a round that's already in progress. They start fresh (level 1, 3 starter picks) but enter a world with higher-tier NPCs.

**Given** a round that has been running for 180 seconds
**When** a new player connects
**Then** the player should be spawned with level 1 and full starter loadout
**And** starter pick offers should be initialized

```yaml
id: mid_round_join
tags: [multiplayer]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  roundTime: 180

actions:
  - playerJoin: { id: newPlayer }

assertions:
  - newPlayer.level: 1
  - newPlayer.startingPicksRemaining: 3
```

---

### Scenario: Round resets world state on new round start

When a new round begins, all world state (NPCs, islands, doubloon pickups, player ships) should be reset to fresh initial values.

**Given** the previous round has ended
**When** a new round is initiated
**Then** NPC count should be 0
**And** all island buildings should be restored to full HP
**And** no doubloon pickups should exist

```yaml
id: round_reset_world_state
tags: [multiplayer]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  previousRound: { ended: true }

actions:
  - startNewRound: {}

assertions:
  - npcs.count: 0
  - islands.allBuildingsRestored: true
  - doubloonPickups.count: 0
```

---

### Scenario: Disconnected player is removed

When a player disconnects (WebSocket close), their ship should be removed from the simulation after a brief grace period to handle temporary drops.

**Given** player A disconnects
**When** the disconnect grace period expires
**Then** player A's ship should be removed from the world
**And** their doubloons should be dropped at their last position

```yaml
id: disconnect_removes_player
tags: [multiplayer]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  playerA: { connected: true, doubloons: 80 }

actions:
  - disconnect: { player: A }
  - advanceTime: 5

assertions:
  - playerA.inWorld: false
```

---

### Scenario: Maximum 10 players per round

The server should enforce a maximum of 10 concurrent players in a single round to maintain simulation performance and gameplay balance.

**Given** a round with 10 connected players
**When** an 11th player attempts to connect
**Then** the connection should be rejected or queued

```yaml
id: max_10_players
tags: [multiplayer]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  round: { playerCount: 10 }

actions:
  - playerJoin: { id: player11 }

assertions:
  - player11.rejected: true
  - round.playerCount: 10
```
