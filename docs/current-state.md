# Current State Inventory

> Accurate catalog of every implemented system, what's tested, and what's designed but not built.
> Last updated: 2026-03-06. Source of truth for agents picking up implementation work.

---

## Architecture Overview

```
shared/           ← Pure logic, runs on BOTH server and client (no DOM/canvas)
  shipState.js        Ship factory, derived stats (ranges, crew efficiency, repair, vision)
  upgradeRegistry.js  Upgrade catalog + rule engine wrapper, MP env hooks
  combat.js           Mount-level broadside, bullet physics, damage, fire/ignition, repair
  physics.js          Ship movement, wind, collisions, ramming
  world.js            Island/building generation, building HP, tower logic
  constants.js        100+ tuning constants (single source of truth)
  roundConfig.js      Round voting categories, vote resolution, config application

server/
  index.js            HTTP + WebSocket server, message routing, spectator management
  simulation.js       20Hz tick loop, phase management (playing/results), director orchestration
  npcDirector.js      NPC spawning, 4 archetypes, 3 AI personalities, difficulty scaling
  upgradeDirector.js  XP/level tracking, upgrade offers (standard + major), server-side apply
  worldManager.js     Building HP tracking, tower firing, defense tier escalation, gold drops
  leaderboardStore.js SQLite persistence (with in-memory fallback), global scores
  chatStore.js        SQLite chat history (with in-memory fallback)

src/core/             ← Single-player specific core logic
  armament.js         Weapon layout normalization, cannon installation
  constants.js        SP-specific constants
  context.js          SP game context
  levelConfig.js      SP level/stage configuration
  math.js             Math utilities
  player.js           SP player logic
  shipMath.js         Hull tier, weapon caps, deck capacity calculations
  shipPhysics.js      SP ship physics
  state.js            SP game state

src/systems/          ← SP system modules
  audioSystem.js      Procedural spatial SFX
  particleEffects.js  VFX particle system
  upgradeRuleEngine.js JSON rule engine (set, add, mul, clamp, autoInstall, etc.)

data/
  upgrades.json       Upgrade catalog (17 standard + 4 major, schema v2)
  ships.json          3 starter ship presets (Balanced Brig, Iron Broadside, Swift Cutter)
  multiplayer-round-options.json  Round voting categories and choices

Client files:
  index.html          Single-player client (standalone, no networking)
  mp.html             Multiplayer client (WebSocket sync, full rendering pipeline)
```

---

## Implemented Systems

### 1. Combat System
**Status**: ✅ Fully implemented
**Files**: `shared/combat.js`, `shared/physics.js`, `shared/constants.js`
**Tests**: `tests/combat.test.js` (per-mount cannon/gun fire, side independence, LOS), `tests/physics.test.js` (wind, ramming)

| Feature | Details |
|---------|---------|
| Gun auto-fire | Per-mount reload, crew efficiency, broadside ±30° arc, targets nearest enemy |
| Manual cannon fire | Client sends aim angle, server fires matching-side cannons, ±30° + pivot arc |
| Bullet physics | Straight-line, range-limited, heavy/light damage scaling (gun 0.18x, cannon 0.28x) |
| Fire/ignition | Cannon hit → 16% + dmg×0.8% chance, DoT 0.52/tick (player) / 0.68/tick (enemy), ~3s duration |
| Passive repair | 0.36/s + repairCrew×0.3/s, suppressed 2.4s after hit, reduced at speed (0.4x→1.0x) |
| Ramming | bowDot > 0.5 threshold, RAM_MULTIPLIER 1.55, self-reduction 0.24, impact cooldown |
| Crew efficiency | `clamp(1.52 - (gunners/demand)×0.58, 0.72, 1.88)`, demand = guns×0.55 + cannons×1.15 |

### 2. Movement System
**Status**: ✅ Fully implemented
**Files**: `shared/physics.js`, `shared/constants.js`
**Tests**: `tests/physics.test.js` (tailwind/headwind effects)

| Feature | Details |
|---------|---------|
| Heading-based steering | A/D or arrow keys, turn rate 0.036 rad/s + rudder/rower bonuses |
| Rowing | W key, accel 0.14 + 0.075 per rower |
| Sail | Space toggle, 0.15 push, 42% effective upwind |
| Wind | Shifts every 18s, strength 0.24±0.4, HUD compass indicator |
| Anchor | S/X key, full stop |
| Speed | Base 2.6, max cap 4.5 |

### 3. NPC System
**Status**: ✅ Fully implemented (no bosses)
**Files**: `server/npcDirector.js`, `shared/constants.js`
**Tests**: `tests/npcDirector.test.js` (archetype rolling, stat scaling, reward scaling)

| Feature | Details |
|---------|---------|
| 4 archetypes | Weak (30%), Standard (35%), Heavy (20%), Scavenger (15%) |
| 3 AI personalities | Aggressor (nearest), Hunter (richest, re-eval 3s), Scavenger (gold-first) |
| AI state machine | approach → broadside → unstick |
| Island avoidance | Emergency flee + 5-probe predictive steering + tangent calculation |
| Spawn rate | `max(1.5, 3.5 - roundTime × 0.004)` seconds between spawns |
| Difficulty tier | `floor(roundTime / 60)` = upgrades per NPC |
| NPC cap | MAX_NPCS = 20 |
| Rewards | `round((3 + upgradeCount×2 + random[0..3]) × archetypeRewardMul)` |

**Not implemented**: Boss spawning. Design doc mentions "periodic boss ship arrivals" and "boss fire-control checks" but no boss code exists in `npcDirector.js`.

### 4. Upgrade System
**Status**: ✅ Fully implemented
**Files**: `shared/upgradeRegistry.js`, `src/systems/upgradeRuleEngine.js`, `server/upgradeDirector.js`, `data/upgrades.json`
**Tests**: `tests/upgradeRuleEngine.test.js` (numeric ops, semantic ops, hooks, catalog building), `tests/upgradesCatalog.test.js` (unique IDs, catalog integrity), `tests/armament.test.js` (weapon layout, installation caps)

| Feature | Details |
|---------|---------|
| Catalog | 17 standard + 4 major = 21 total upgrades |
| Rule engine | Ops: set, add, mul, min, max, clamp, autoInstallCannons, autoInstallGuns, ensureRepairCrew, addAbility, call |
| Starter picks | 3 pre-game picks (startingPicksRemaining counter) |
| Standard offers | 3 random on each level-up |
| Major offers | 3 random every 5 levels (5, 10, 15, 20...) |
| Level growth | Per level: +0.6 size, +2 maxHp, +4 heal |
| XP curve | `xpToNext = floor(prev × 1.18 + 3)`, starting at 8 |
| MP filter | Salvage-skiffs removed from MP pool |

**Standard upgrades**: crew-musketeers, cannons, gun-installments, cannon-installments, powder-magazines, boarding-drums, rowers, quartermaster-stores, repair-crew, salvage-skiffs (MP cut), reinforced-hull, ram-bow, sail-mastery, rudder-upgrade, cannon-trunnions, crows-nest, reef-runner

**Major upgrades**: Dreadnought Hull (+5 size, +40 HP), Crimson Sails (+0.45 speed, faster reload), Grand Broadside (+2 cannons/side, +10 dmg), Iron Ram Prow (+38 ram damage)

### 5. Island System
**Status**: ✅ Fully implemented
**Files**: `shared/world.js`, `server/worldManager.js`
**Tests**: None dedicated. Island generation tested implicitly through round config tests.

| Feature | Details |
|---------|---------|
| Generation | Seeded (mulberry32), 18 islands, 3 size classes, 8-12 vertex outlines |
| Buildings | HP tracked server-side, destructible, drop 2-5 doubloons |
| Damage scaling | Gun hits: dmg × 0.15, Cannon hits: dmg × 0.25 |
| Tower defenses | Fire at nearest ship, range 300 + defenseLevel×20 |
| Defense escalation | +1 tier every 90 seconds |
| Collision | Speed → 25%, push away from center, contact damage based on mass |
| Docks | 1-3 per island, rendered as brown piers |

### 6. Round Lifecycle
**Status**: ✅ Fully implemented
**Files**: `server/simulation.js`, `server/index.js`
**Tests**: `tests/roundConfig.test.js` (vote categories, config resolution, tiebreaking)

| Feature | Details |
|---------|---------|
| Duration | 10 minutes (600 seconds) at 20 FPS |
| Phases | `playing` → `results` (20s) → `resetRound()` |
| Round voting | 4 categories (enemy density, map size, island count, island size) |
| Vote resolution | Tally per category, winner applied, ties → default |
| Results broadcast | `roundEnded` event with summary (K/D/doubloons/scores per player) |
| Score formula | `(doubloons × 0.1) + (K/D × doubloons)` |

### 7. Leaderboard
**Status**: ✅ Fully implemented
**Files**: `server/leaderboardStore.js`
**Tests**: `tests/chatStore.test.js` (SQLite persistence pattern tested here; leaderboard uses same pattern)

| Feature | Details |
|---------|---------|
| Storage | SQLite (better-sqlite3) with WAL mode, 5-backup rotation |
| Fallback | In-memory Map if SQLite unavailable |
| Fields | name, lifetime_score, best_round_score, last_round_score, rounds_played |
| API | `saveRoundSummary()` upsert, `getTopScores(limit)` sorted query |
| Broadcast | Top 100 sent on join + round end |

### 8. Chat
**Status**: ✅ History implemented, ❌ Moderation not implemented
**Files**: `server/chatStore.js`, `server/index.js`
**Tests**: `tests/chatStore.test.js` (SQLite persistence, message ordering, fallback)

| Feature | Details |
|---------|---------|
| Storage | SQLite / in-memory fallback |
| History | Last 200 messages replayed to joining clients |
| Broadcast | All messages sent to all connected clients |
| Moderation | **NOT IMPLEMENTED** — no LLM, no profanity filter, no timeout escalation |

### 9. Spectator Mode
**Status**: ✅ Fully implemented
**Files**: `server/index.js`, `mp.html`
**Tests**: None

| Feature | Details |
|---------|---------|
| Cap | ACTIVE_PLAYER_LIMIT = 10 |
| Overflow | Players 11+ set to `spectator: true` |
| Enforcement | Server ignores `input` and `cannonFire` from spectators |
| Client | Spectator banner, roster marking, `roleUpdate` message on transition |

### 10. Client Rendering
**Status**: ✅ Fully implemented (with partial gaps)
**Files**: `mp.html`, `src/rendering/shipRenderer.js`
**Tests**: None (visual)

**Fully working**: Water grid, islands (polygons, foliage, docks, buildings, towers), doubloon drops, ship hulls (hull shape, weapon mounts, armor plates, sail, fire overlay, deck damage), bullets, particles (muzzle blast, impact debris, wake, explosions, building dust), fog-of-war + cloud mask, HUD (timer, XP bar, stats, leaderboard, chat, upgrade cards, scoreboard, kill feed, wind compass, nearest-player skull indicator, aim crosshair), results screen, vote UI, spectator banner.

**Partial**: Aim range circles (crosshair exists, gun/cannon range rings not drawn), cannon barrel pivot (static, no live rotation), reload bars in HUD (not implemented).

---

## Existing Test Coverage

| Test File | System | Key Assertions |
|-----------|--------|----------------|
| `tests/armament.test.js` | Weapon layout | Layout normalization, cannon installation, hull cap clamping, rack bonus |
| `tests/combat.test.js` | Combat firing | Per-mount cannon fire, side independence, LOS rejection, gun target range |
| `tests/physics.test.js` | Movement + ramming | Tailwind boost, headwind penalty, ram damage > normal collision, low-speed no-damage |
| `tests/npcDirector.test.js` | NPC system | Archetype distribution (weak/standard/heavy/scavenger), stat scaling, reward ordering |
| `tests/roundConfig.test.js` | Round voting | Base config, vote application, effect accumulation, tiebreaking, disconnected vote cleanup |
| `tests/roundScore.test.js` | Scoring | Base 10% doubloon reward, PvP bonus formula, NaN/zero safety |
| `tests/shipMath.test.js` | Ship geometry | Tier computation, weapon caps, deck capacity (min 2), hull half-width |
| `tests/upgradeRuleEngine.test.js` | Upgrade engine | Add/clamp ops, addAbility, autoInstallCannons, ensureRepairCrew, call hooks, catalog building |
| `tests/upgradesCatalog.test.js` | Upgrade data | Unique IDs across pools, new upgrade existence verification |
| `tests/chatStore.test.js` | Chat persistence | SQLite roundtrip, fallback mode, chronological ordering |
| `scripts/check-runtime-parity.mjs` | Runtime | Node version enforcement (package.json ↔ .nvmrc ↔ CI) |

### Test Coverage Gaps

- No E2E round lifecycle tests (playing → results → reset)
- No spectator mode tests (role transitions, input rejection)
- No tower defense / defense escalation tests
- No leaderboard persistence tests (uses same SQLite pattern as chat, but untested)
- No integration tests (multi-system interactions)
- No island generation determinism tests
- No upgrade offer flow tests (starter picks → normal → major cadence)
- No fire/ignition probability tests
- No NPC AI behavior tests (approach → broadside → unstick state transitions)

---

## Designed But Not Built

| Feature | Design Location | Gap |
|---------|-----------------|-----|
| Boss spawning | DESIGN.md ("periodic boss ship arrivals that gate major progression spikes") | Zero code. No boss archetype, no spawn logic, no boss AI, no boss rewards. |
| Chat LLM moderation | multiplayer_layout_and_flow.md §7 | Only chat history/broadcast exists. No moderation agent, no timeout escalation. |
| Ranked leagues | multiplayerthoughts.md | Scoring formula exists in code. League tiers (Bronze→Captain), percentile mapping, weekly periods — all design-only. |
| Cosmetic titles | multiplayerthoughts.md | 4 titles defined (The Swabbie, Bilge Rat, Drunken Sailor, Landlubber). No code. |
| Title screen | multiplayer_layout_and_flow.md §1 | No title screen. MP client connects directly. |
| Main hub | multiplayer_layout_and_flow.md §2 | No hub UI. No Quick Join, Server Browser, Profile, Friends, Ignore. |
| Pre-round lobby | multiplayer_layout_and_flow.md §4 | No lobby phase. Players spawn directly into playing phase. |
| AFK protection | multiplayer_layout_and_flow.md §6 | No inactivity detection. No auto-removal. |
| Post-game flow | multiplayer_layout_and_flow.md §10 | No "Stay in Lobby?" prompt. Round auto-resets. |
| Aim range circles | ROADMAP.md Batch F | Crosshair exists. Gun/cannon range rings not drawn. |
| Cannon barrel pivot | ROADMAP.md Batch F | Cannon rects are static. No live rotation toward aim. |
| Reload bars | ROADMAP.md Batch F | Not implemented. |
| Named difficulty stages | DESIGN.md | SP has 4 named stages (Coastal → Kraken Frontier). MP uses smooth ramp only. |

---

## Key Balance Numbers (Current)

| Constant | Value | File |
|----------|-------|------|
| Base HP | 20 | shared/constants.js |
| Base speed | 2.6 | shared/constants.js |
| Max speed | 4.5 | shared/constants.js |
| Base gun damage | 9 | shared/constants.js |
| Gun damage scale | 0.18x | shared/constants.js |
| Cannon bonus damage | +4 | shared/constants.js |
| Cannon damage scale | 0.28x | shared/constants.js |
| Gun reload | 1.35s | shared/constants.js |
| Cannon reload | 3.4s | shared/constants.js |
| Fire chance base | 16% | shared/constants.js |
| Fire chance per dmg | +0.8% | shared/constants.js |
| Ram damage base | 46 | shared/constants.js |
| Repair base rate | 0.36/s | shared/constants.js |
| Repair per crew | +0.3/s | shared/constants.js |
| Repair suppress | 2.4s | shared/constants.js |
| Passive doubloons | 0.5/s | shared/constants.js |
| XP start | 8 | shared/constants.js |
| XP scale | 1.18x | shared/constants.js |
| NPC spawn interval | max(1.5, 3.5 - t×0.004) | server/npcDirector.js |
| NPC difficulty tier | floor(roundTime / 60) | server/npcDirector.js |
| NPC cap | 20 | server/npcDirector.js |
| Tower escalation | +1 tier / 90s | server/worldManager.js |
| Round duration | 600s | server/simulation.js |
| Results phase | 20s | server/simulation.js |
| Active player cap | 10 | server/index.js |
