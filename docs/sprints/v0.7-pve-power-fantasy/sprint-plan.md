# Sprint v0.7 — PvE Power Fantasy

> **Theme**: Make AI enemies feel like a real escalating threat; give players the "captain of a growing war machine" fantasy.
>
> **Vertical slice**: By the end of this sprint, a solo player in a multiplayer round should feel the full 10-minute arc — safe early looting, dangerous mid-game, climactic boss fight, satisfying power spike.

---

## Goals

1. **Boss encounters** — the flagship feature. Three boss archetypes that create memorable mid-and-late-game moments.
2. **Named difficulty stages** — clear visual + mechanical transitions (Calm Waters → Contested Seas → War Zone → Kraken Frontier).
3. **Stage-gated NPC archetypes** — restrict which NPC types appear in each stage to reinforce the difficulty curve.
4. **Rebalance pass** — tune constants so the power fantasy lands: players should feel weak at minute 1 and dominant by minute 8.

---

## Stories

### Story 1: Boss Director (server)

**Summary**: Implement a boss director on the server that spawns boss NPCs on a schedule.

**Acceptance scenarios**:
- [boss_first_spawn_at_tier2](../scenarios/pve/boss-encounters.scenarios.md) — first boss at ~2:30
- [boss_hp_scales_with_tier_and_players](../scenarios/pve/boss-encounters.scenarios.md)
- [boss_single_instance](../scenarios/pve/boss-encounters.scenarios.md)
- [boss_cadence_3_4_per_round](../scenarios/pve/boss-encounters.scenarios.md)

**Implementation notes**:
- New file: `server/bossDirector.js`
- Integrate into simulation.js tick loop
- Boss state stored in worldManager alongside NPCs but with `isBoss: true` flag
- Each boss archetype has a behavior function (like NPC AI personalities)

---

### Story 2: War Galleon Boss

**Summary**: Implement the War Galleon boss archetype with broadside attack patterns.

**Acceptance scenarios**:
- [boss_war_galleon_broadside](../scenarios/pve/boss-encounters.scenarios.md)

**Implementation notes**:
- Large ship entity (~3× player size at level 10)
- Sails toward the nearest cluster of players
- Fires massive 6-cannon broadsides every 4 seconds
- HP scales: 50 × tier + 20 × player_count

---

### Story 3: Fire Ship Boss

**Summary**: Implement the Fire Ship boss that rams and ignites.

**Acceptance scenarios**:
- [boss_fire_ship_ram_ignite](../scenarios/pve/boss-encounters.scenarios.md)

**Implementation notes**:
- Fast, small-ish entity that aggressively chases the highest-scoring player
- On ram collision: guaranteed fire ignition + 2× duration
- Self-destructs on ram (drops doubloons)

---

### Story 4: Kraken Boss

**Summary**: Implement the Kraken boss with area-denial tentacle mechanics.

**Acceptance scenarios**:
- [boss_kraken_area_denial](../scenarios/pve/boss-encounters.scenarios.md)

**Implementation notes**:
- Stationary entity that spawns at a random deep-water location
- Creates tentacle hazard zones in a radius
- Players in hazard zone take periodic damage
- Requires sustained DPS to defeat (rewards coordinated assault)

---

### Story 5: Boss Kill Rewards

**Summary**: Boss kills drop doubloons + a major upgrade offer for the killing player.

**Acceptance scenarios**:
- [boss_kill_reward_doubloons_and_major](../scenarios/pve/boss-encounters.scenarios.md)
- [boss_splash_rewards_nearby](../scenarios/pve/boss-encounters.scenarios.md)

**Implementation notes**:
- Killing player: large doubloon burst + immediate major upgrade offer
- All players within 300 units: smaller doubloon reward (splash rewards)
- This incentivizes group boss fights even in a PvPvE context

---

### Story 6: Named Difficulty Stages

**Summary**: Divide the 10-minute round into 4 named stages with distinct mechanics.

**Acceptance scenarios**:
- [stage_transition_calm_to_contested](../scenarios/pve/difficulty-curve.scenarios.md)
- [stage_transition_contested_to_warzone](../scenarios/pve/difficulty-curve.scenarios.md)
- [stage_transition_warzone_to_kraken](../scenarios/pve/difficulty-curve.scenarios.md)
- [calm_waters_weak_npcs_only](../scenarios/pve/difficulty-curve.scenarios.md)
- [towers_inactive_during_calm_waters](../scenarios/pve/difficulty-curve.scenarios.md)

**Implementation notes**:
- Stage boundaries: 0:00→2:00 (Calm), 2:00→5:00 (Contested), 5:00→8:00 (War), 8:00→10:00 (Kraken)
- Stage name stored in round state, broadcast on transition
- npcDirector reads current stage to filter archetype pool
- Tower activation gated by stage (inactive in Calm Waters)

---

### Story 7: Boss Spawn Announcement

**Summary**: When a boss spawns, broadcast an event with boss name, type, and directional indicator.

**Acceptance scenarios**:
- [boss_spawn_announcement](../scenarios/pve/boss-encounters.scenarios.md)

**Implementation notes**:
- Server broadcasts: `{ type: 'bossSpawn', bossType, x, y }`
- Client shows HUD notification + directional indicator arrow

---

### Story 8: Rebalance Pass

**Summary**: Tune the existing constants so the power fantasy curve feels right across the 4 stages.

**Acceptance scenarios**:
- [expected_level_pacing](../scenarios/progression/leveling.scenarios.md)
- [late_game_npcs_are_threatening](../scenarios/pve/difficulty-curve.scenarios.md)
- [level20_power_vs_level1](../scenarios/progression/ship-growth.scenarios.md)

**Implementation notes**:
- Adjust XP_START / XP_SCALE / XP_ADD if pacing is off
- Tune NPC_SPAWN_INTERVAL_BASE and MAX_NPCS
- Adjust BASE_HP, level-up bonuses, upgrade magnitudes
- Validate with a simulated 10-minute run (automated test)

---

## Definition of Done

- [ ] All `status: pending` scenarios tagged `sprint: v0.7` have tests and pass
- [ ] All `status: passing` regression scenarios still pass
- [ ] `npm test` exit code 0
- [ ] Manual playtest: solo player feels the full 10-minute arc
- [ ] Boss encounters feel like "boss fights" (dangerous, rewarding, memorable)
- [ ] Stage transitions are noticeable to the player (HUD indicator, different NPC types)

---

## Branch Structure

```
main
└── release/v0.7
    ├── feature/boss-director
    ├── feature/war-galleon-boss
    ├── feature/fire-ship-boss
    ├── feature/kraken-boss
    ├── feature/boss-rewards
    ├── feature/named-stages
    ├── feature/boss-announcement
    └── feature/rebalance-v0.7
```

Each feature branch PRs into `release/v0.7`. When all stories pass, `release/v0.7` PRs into `main` with full regression suite.
