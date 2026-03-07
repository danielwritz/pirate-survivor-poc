# Spectator Scenarios

> Post-death spectating, camera following, and spectator state management.

---

### Scenario: Dead player enters spectator mode

When a player's ship is destroyed and they cannot yet respawn (or choose not to), they should automatically enter spectator mode and view a surviving player.

**Given** player A dies
**When** the respawn timer has not expired or the player opts to spectate
**Then** player A should enter spectator mode
**And** the camera should follow a living player

```yaml
id: dead_player_enters_spectator
tags: [multiplayer, spectator]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  playerA: { alive: false }

actions:
  - enterSpectator: { player: A }

assertions:
  - playerA.spectating: true
  - playerA.spectateTarget: { not: null }
```

---

### Scenario: Spectator can cycle between living players

Spectators should be able to press a key to cycle to the next living player's perspective.

**Given** player A is spectating player B
**And** players B, C, and D are alive
**When** player A presses the "next spectate" key
**Then** the spectate target should switch to player C

```yaml
id: spectator_cycle_targets
tags: [multiplayer, spectator]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  playerA: { spectating: true, spectateTarget: B }
  alivePlayers: [B, C, D]

actions:
  - cycleSpectateTarget: { direction: next }

assertions:
  - playerA.spectateTarget: C
```

---

### Scenario: Spectator does not affect game simulation

A spectating player should have no ship in the simulation and should not be targetable by NPCs, towers, or other players.

**Given** player A is in spectator mode
**When** the simulation tick runs
**Then** no ship entity should exist for player A
**And** NPCs should not target player A

```yaml
id: spectator_no_simulation_impact
tags: [multiplayer, spectator]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  playerA: { spectating: true }

actions:
  - tickSimulation: {}

assertions:
  - playerA.shipInWorld: false
  - npcTargets: { not_contains: A }
```

---

### Scenario: Spectator receives full game state updates

Spectators should continue receiving the full state broadcast so they can see the game unfold in real time from any perspective.

**Given** player A is spectating
**When** the server sends a state update tick
**Then** player A should receive the state broadcast with all entity positions

```yaml
id: spectator_receives_state
tags: [multiplayer, spectator]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  playerA: { spectating: true }

actions:
  - tickAndBroadcast: {}

assertions:
  - playerA.receivedStateUpdate: true
```

---

### Scenario: Spectator exits when respawn is available

When the respawn timer completes, the spectating player should be offered the choice to respawn, which exits spectator mode and re-enters the game.

**Given** player A is spectating and the respawn timer has expired
**When** player A requests respawn
**Then** spectator mode should end
**And** a new ship should be spawned for player A

```yaml
id: spectator_exit_on_respawn
tags: [multiplayer, spectator]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  playerA: { spectating: true, respawnAvailable: true }

actions:
  - respawn: { player: A }

assertions:
  - playerA.spectating: false
  - playerA.shipInWorld: true
```
