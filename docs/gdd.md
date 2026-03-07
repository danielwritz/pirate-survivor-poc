# Pirate Survivor — Game Design Document

> **Authoritative design reference.** Consolidates vision, mechanics, multiplayer rules, and progression.
> For implementation status see `docs/current-state.md`. For scenario format see `docs/scenario-format.md`.
> This document supersedes DESIGN.md, ROADMAP.md, multiplayerthoughts.md, and multiplayer_layout_and_flow.md
> for design decisions. Those files remain as historical references.

---

## 1. Vision & Pillars

### Vision
A pirate-themed naval roguelike where a small ship grows into a floating fortress through upgrades, crew expansion, and tactical navigation — played competitively in 10-minute ranked PvPvE rounds.

### Core Fantasy
You start as a humble sloop. Ten minutes later, you're a bristling dreadnought with a crew of musketeers, rows of cannons, and a ram prow cutting through burning wreckage. The ocean that threatened you now fears you.

### Design Pillars

**1. Clear, Responsive Visuals**
- Polygon-first, readable at a glance. No decorative clutter that obscures gameplay.
- Upgrades must be *visible* on the ship: new cannons appear, hull grows, armor color changes, sails shift.

**2. Simple Upgrade Language**
- Short, obvious, role-first names. Effect clarity is immediate.
- Fewer text-heavy concepts; stronger visual and mechanical identity.

**3. Meaningful Upgrade Feedback**
- Every upgrade choice should produce an observable change in behavior or appearance.
- The player should *feel* the difference within seconds of picking.

**4. Multiplayer as Primary Mode**
- Single-player is sandbox/practice. **Ranked PvPvE is the core experience.**
- All mechanics must work in a 10-minute competitive match context.
- Authoritative server architecture for integrity.

**5. Short-Session Satisfaction**
- One round = one complete arc (weak → powerful → challenged → triumphant/defeated).
- No 45-minute commitments. Respect the player's time.

---

## 2. Core Gameplay Loop

```
Navigate hostile waters
  → Auto-fire guns at nearest threats
  → Manually aim cannons at priority targets
  → Collect doubloons from kills / raids / the world
  → Level up → Choose upgrades (ship grows)
  → Survive escalating NPC pressure + player threats
  → Round ends → Score → Rank → Vote → Next round
```

### The 10-Minute Arc

| Phase | Time | Player Experience |
|-------|------|-------------------|
| **Scramble** | 0:00–2:00 | Choose 3 starter upgrades. Kill early weak NPCs. Establish build direction. |
| **Growth** | 2:00–5:00 | Leveling accelerates. Ship visibly transforms. First major upgrade at level 5. Engage other players for doubloon advantage. |
| **Power** | 5:00–8:00 | Fortress moment. Ship is heavy with upgrades. NPCs are still scaling but manageable. PvP stakes are highest (rich targets). Boss encounters challenge even strong ships. |
| **Climax** | 8:00–10:00 | NPC pressure peaks. Tier 8-10 enemies are genuinely dangerous. Survival requires skill even with a loaded ship. Final boss as capstone challenge. |
| **Results** | 10:00+ | 20-second results phase. Scores, awards, vote on next round. |

---

## 3. Combat

### Weapons

**Guns** (auto-fire, volume-based DPS):
- Fire automatically at nearest enemy within range
- Broadside-only: ±30° from perpendicular
- Per-mount reload timers (base 1.35s, affected by crew efficiency)
- 2-3 musket balls per volley with spread
- Effective damage: ~1 per hit after 0.18x scaling
- Role: consistent background DPS, no player input needed

**Cannons** (player-aimed, burst damage):
- Player clicks to aim; server fires cannons on the matching broadside
- Broadside ±30° + cannonPivot bonus (up to ±22° from upgrades)
- Per-mount reload (base 3.4s, affected by crew efficiency)
- 1 cannonball per shot
- Effective damage: ~3.6 per hit after 0.28x scaling
- Can ignite targets: 16% base + 0.8% per damage point
- Role: skill-expression weapon, alpha strikes, decisive engagements

**Ramming** (positional, high-risk):
- Requires `ram` ability (from Ram Prow upgrades)
- Bow-dot > 0.5 threshold (must be aimed bow-first)
- Damage = ramDamage × bowFactor × closingFactor × scale × multiplier
- Self-damage reduction (0.24x)
- Role: aggressive close-range playstyle, punishes stationary targets

### Fire System
- Cannon hits roll ignition chance: 16% + (damage × 0.8%)
- Fire ticks every 0.2s, dealing 0.52 damage (players) or 0.68 (NPCs)
- Duration: ~3 seconds (15 ticks)
- Creates pressure to disengage; synergizes with cannon-heavy builds

### Passive Repair
- Base rate: 0.36 HP/s + 0.3 per repair crew member
- Suppressed for 2.4 seconds after taking any damage
- Reduced by movement: 1.0x stationary → 0.4x at max speed
- Design tension: stop to heal (vulnerable) or keep moving (no/slow repair)

### Crew Efficiency
- Formula: `clamp(1.52 - (gunners / demand) × 0.58, 0.72, 1.88)`
- Demand = guns × 0.55 + cannons × 1.15
- Under-crewed weapons reload slower; balanced crew is optimal
- Adding weapons without adding gunners has diminishing returns

---

## 4. Movement & Navigation

### Controls
| Input | Action |
|-------|--------|
| A/D or ←/→ | Steer (heading-based, with momentum) |
| W or ↑ | Row (crew-based acceleration) |
| Space | Toggle sail (wind-powered movement) |
| S or ↓ / X | Brake / anchor |
| Mouse click | Aim cannons |
| F | Toggle auto-fire |
| 1/2/3 | Select upgrade |
| Tab | Scoreboard |
| Enter | Chat |

### Wind System
- Wind direction shifts every 18 seconds
- Wind strength: 0.24 ± 0.4 (variable)
- Sail push: 0.15 base, 42% effective sailing upwind
- Visual: HUD compass arrow showing wind direction
- Creates strategic routing decisions — sailing with the wind is significantly faster

### Ship Physics
- Base speed: 2.6, max cap: 4.5
- Rowing acceleration: 0.14 + 0.075 per rower
- Turn rate: 0.036 rad/s + rudder/rower bonuses
- Mass affects collision, acceleration, and handling
- Heavier ships (from upgrades) have more inertia

---

## 5. Upgrade System

### Structure
- **17 standard upgrades**: Repeatable, stackable. Offered 3-at-a-time on each level-up.
- **4 major upgrades**: High-impact, transformative. Offered 3-at-a-time every 5 levels.
- All upgrades applied via JSON rule engine (set, add, mul, clamp, autoInstall, etc.)

### Standard Upgrades

| ID | Name | Key Effects | Role |
|----|------|-------------|------|
| crew-musketeers | Flintlock Crew | +1 crew/gunner, -0.05 reload | Gun DPS |
| cannons | Cannoneers | +1 cannon/side, +3 dmg, -0.1 cannon reload | Cannon burst |
| gun-installments | Deck Guns | +1 gun/side, -0.03 reload, +1 dmg | Gun volume |
| cannon-installments | Cannon Racks | +1 cannon slot/side, +size/mass | Cannon capacity |
| powder-magazines | Powder Magazines | -0.14 cannon reload, +2 dmg | Cannon efficiency |
| boarding-drums | Boarding Drums | +2 crew, +1 rower/gunner, +0.1 speed | Hybrid |
| rowers | Row Crew | +1 rower, +0.16 speed | Mobility |
| quartermaster-stores | Quartermaster | +8 maxHP, heal 8, -0.04 reload | Sustain |
| repair-crew | Shipwrights | +1 repair crew | Defense |
| reinforced-hull | Hull Plating | +15 maxHP, +1 armor tier | Tank |
| ram-bow | Ram Prow | Enables/enhances ramming | Aggression |
| sail-mastery | Sail Mastery | +0.25 speed | Mobility |
| rudder-upgrade | Rudder Upgrade | +rudder bonus | Handling |
| cannon-trunnions | Cannon Trunnions | +cannonPivot | Cannon arc |
| crows-nest | Crow's Nest | +lookoutRange | Vision |
| reef-runner | Reef Runner | Speed + handling | Mobility |

*Note: salvage-skiffs removed from MP pool.*

### Major Upgrades

| ID | Name | Key Effects | Fantasy |
|----|------|-------------|---------|
| dreadnought-hull | Dreadnought Hull | +5 size, +40 HP | Unkillable fortress |
| crimson-sails | Crimson Sails | +0.45 speed, faster reload | Speed demon |
| grand-broadside | Grand Broadside | +2 cannons/side, +10 dmg | Alpha strike |
| iron-ram-prow | Iron Ram Prow | +38 ram damage | Battering ram |

### Upgrade Pacing
- Level 1-3: First 3 standard picks (starter phase, before combat)
- Level 4+: Standard offer on each level-up
- Level 5, 10, 15, 20: Major upgrade offer

### Build Archetypes (emergent)
Players naturally gravitate toward one of these through upgrade choices:
- **Gunboat**: Stack guns + musketeers → high sustained DPS
- **Broadside**: Stack cannons + powder → devastating alpha strikes
- **Tank**: Hull plating + repair crew + quartermaster → outlast everything
- **Speed**: Rowers + sails + rudder → chase/escape, positional advantage
- **Ram**: Ram prow + speed → weaponize the hull, close-range brawler

---

## 6. Economy

### Doubloon Sources
| Source | Amount | Notes |
|--------|--------|-------|
| NPC kill | `round((3 + upgrades×2 + rand[0..3]) × archetype_mul)` | Scales with difficulty |
| Building destruction | 2–5 per building | Scattered at death location |
| Player kill | 20% of victim's doubloons | Dropped as world loot |
| Passive income | 0.5/s | Always flowing |
| Boss kill | TBD (not yet designed) | Expected: large reward |

### Doubloons = XP
- Collecting doubloons awards XP toward the next level
- XP curve: `xpToNext = floor(prev × 1.18 + 3)`, starting at 8
- Level 1→2: 8 XP, Level 5: ~30 XP, Level 10: ~96 XP, Level 20: ~686 XP
- Passive 300 doubloons/round from just surviving = ~level 15-17 by round end
- Aggressive play (kills + raids) can reach level 25-30+

### Death Penalty
- 20% of held doubloons dropped as world loot at death location
- Anyone can pick them up (creates contested hotspots)
- Ship and upgrades are kept
- Respawn at farthest point from all active players

---

## 7. NPC Enemies

### Archetypes

| Type | Spawn % | Key Traits |
|------|---------|------------|
| Weak (Sloop) | 30% | 0.82x size, 0.68x HP, 0.96x speed. Fodder. |
| Standard (Pirate) | 35% | Baseline. Reliable threat. |
| Heavy (Raider) | 20% | 1.25x size, 2.1x HP, +2 gunners, +1 cannon. Tanky. |
| Scavenger | 15% | 1.15x speed. Hunts gold drops first, then players. |

### AI Personalities
- **Aggressor**: Targets nearest player. Default for weak/standard.
- **Hunter**: Targets richest player. Re-evaluates every 3 seconds. Used by heavy.
- **Scavenger**: Prioritizes gold drops within 600 units, then nearest player.

### AI State Machine
`approach` → turn toward target
`broadside` → perpendicular positioning, auto-fire
`unstick` → recover from terrain collision (random turn, then approach)

### Difficulty Scaling
- Spawn interval: `max(1.5, 3.5 - roundTime × 0.004)` — doubles from start to end
- Difficulty tier: `floor(roundTime / 60)` — +1 random standard upgrade per NPC per minute
- NPC cap: 20 simultaneous
- By minute 10: NPCs have up to 10 random upgrades each

---

## 8. Boss Encounters

> **STATUS: NOT YET IMPLEMENTED. Design below is the target.**

### Design Goals
- Bosses are the milestone moments in the 10-minute arc
- They test the player's build and create dramatic tension
- In multiplayer, bosses are shared threats that can force temporary alliances or risky opportunism
- Boss kills should feel rewarding and progression-significant

### Boss Spawning
- **Trigger**: Timer-based. First boss at ~2:30 (tier 2), then every ~2:00-2:30
- **Expected bosses per round**: 3-4
- **Announcement**: Server broadcasts boss spawn event. Client shows directional indicator + audio cue.
- **Spawn location**: Farthest from all players (similar to NPC spawning, but guaranteed open water)

### Boss Archetypes

| Boss | Tier | Defining Trait | Mechanical Identity |
|------|------|----------------|---------------------|
| **War Galleon** | Early (tier 2-3) | Large, slow, many cannons | Broadside-check: forces players to respect cannon arcs |
| **Fire Ship** | Mid (tier 4-5) | Fast, rams, ignites on contact | Positioning-check: punishes stationary/slow players |
| **Kraken** | Late (tier 7+) | Massive, high HP, area denial | Endurance-check: sustained DPS test, rewards all build paths |

### Boss Stats (Scaling)
- Size: 30 + 1.2 × tier + 0.6 × playerCount
- HP: 260 + 18 × tier + 45 × tier²
- Crew/weapons scale with tier
- Boss hull shapes are procedurally varied (asymmetric, imposing)

### Boss AI
- More sophisticated than regular NPCs
- War Galleon: slow tracking rotation, devastating broadside volleys, telegraph before firing
- Fire Ship: aggressive pursuit, ram-focused, leaves fire trail
- Kraken: area-denial patterns, tentacle sweep (radial damage zone), phase transitions at HP thresholds

### Boss Rewards
- Large doubloon drop (50 + 10 × tier)
- Guaranteed major upgrade offer to the killing blow player
- In MP: credit goes to player who deals killing blow. All nearby players get doubloon splash (smaller share).
- Boss kill announced to all players (kill feed + audio)

### Multi-Player Boss Dynamics
- Boss is hostile to all ships (players and NPCs)
- Multiple players can engage simultaneously
- Creates emergent decisions: cooperate to kill boss? Let others fight it and ambush the weakened winner?
- 20% doubloon drop on player death near boss creates high-stakes zones

---

## 9. Difficulty Stages

> **STATUS: PARTIALLY DESIGNED. Named stages exist in SP (DESIGN.md) but MP uses smooth ramp only.**

### Target Design
Rather than a smooth invisible ramp, named stages give players a sense of progression and communicate danger.

| Stage | Time | NPC Tier | Key Change |
|-------|------|----------|------------|
| **Calm Waters** | 0:00–2:00 | 0-1 | Weak NPCs only. Learning/setup time. No towers fire. |
| **Contested Seas** | 2:00–5:00 | 2-4 | Standard + heavy NPCs appear. Towers activate. First boss. |
| **War Zone** | 5:00–8:00 | 5-7 | Scavengers appear. Towers dangerous. Bosses every ~2 min. NPC density high. |
| **Kraken Frontier** | 8:00–10:00 | 8-10 | Max pressure. Kraken boss. NPCs are fully upgraded. Towers lethal. |

### Stage Transitions
- Announced to all players: centered text + audio sting
- Visual shift: water color subtly darkens at each stage
- Mechanical: stage name determines which NPC archetypes can spawn, tower aggression, boss schedule

---

## 10. Islands & World

### Generation
- Procedurally seeded (per-round seed from timestamp)
- 18 islands, 3 size classes, 8-12 vertex irregular outlines
- Min spacing: 280 units between islands
- 1-3 docks per island, decorative foliage
- World size: ~3000 × 2100 (modifiable by round voting)

### Buildings
- Placed on islands, tracked server-side with HP
- Destructible by weapons (gun: damage × 0.15, cannon: damage × 0.25)
- Drop 2-5 doubloons on destruction, scattered with velocity
- Become towers based on defense tier

### Tower Defenses
- Chance of any building being a tower: 15% base + 8% per defense tier, max 85%
- Tower fire rate: 1.6s → 0.7s (scales with tier)
- Tower damage: 5 + 1.5 × level
- Tower range: 300 + defenseLevel × 20
- Defense tier: +1 every 90 seconds
- Early game: islands are profitable, low risk. Late game: islands are fortresses.

### Island Collision
- Ships slow to 25% speed on contact
- Push away from center
- Contact damage: (0.5 + mass × 0.008) × dt × 0.5

---

## 11. Multiplayer Systems

### Round Format
- 10-minute PvPvE rounds, up to 10 active players
- Equal starter ships (no pre-match loadout advantage)
- Authoritative server (Node + WebSocket, 20 Hz tick rate)
- State snapshot broadcast every tick (50ms)

### Round Voting (Post-Match)
Players vote on next round's parameters during the 20-second results phase:

| Category | Choices |
|----------|---------|
| Enemy Density | Normal / More (+6 cap) / Fewer (-6 cap) |
| Map Size | Normal / Larger (+15%) / Smaller (-15%) |
| Island Count | Normal / More (+4) / Fewer (-4) |
| Island Size | Normal / Bigger (+18%) / Smaller (-18%) |

Tiebreaker: default choice wins.

### Spectator Mode
- Active player cap: 10
- Overflow players enter as spectators (watch + chat, no input)
- `roleUpdate` message on transition
- Spectator banner displayed in client

### Leaderboard
- SQLite persistence (with in-memory fallback)
- Tracks: lifetime_score, best_round_score, last_round_score, rounds_played
- Round score: `(doubloons × 0.1) + (K/D × doubloons)`
- Top 100 broadcast on join + round end
- 5-backup rotation for data safety

### Chat
- Broadcast to all connected clients
- History: last 200 messages replayed on join
- SQLite persistence (with in-memory fallback)

---

## 12. Ranking & Leagues

> **STATUS: DESIGNED, NOT IMPLEMENTED.**

### Weekly Score
- K = player kills, D = deaths, DB = doubloons collected
- `KDR = K / max(D, 1)`
- `DBNorm = DB / 10000`
- `PlayerScore = KDR × DBNorm`
- Pure PvE farmers score 0 (no kills). Pure PvP without doubloons scores low. Both required.

### League Tiers (4 × III subdivisions)

| Tier | Name | Rank Range |
|------|------|------------|
| Bronze | Deckhand | III → II → I |
| Silver | Boatswain | III → II → I |
| Gold | Quartermaster | III → II → I |
| Apex | Captain | III → II → I |

Display: `⚓ II  PlayerName  CosmeticTitle`

### Cosmetic Titles (v0)
Unlock on reaching a tier + staying 1 full week.

| Active | Inactive |
|--------|----------|
| The Swabbie | Former Swabbie |
| Bilge Rat | Veteran Bilge Rat |
| Drunken Sailor | Once a Drunken Sailor |
| Landlubber | Reformed Landlubber |

---

## 13. UI/UX Flow

### Title Screen → Main Hub
- Full-screen background art → centered menu (Play / Settings / Exit)
- Main Hub: Quick Join, Server Browser, Single Player | Profile, Friends, Ignore | Global Chat

### Multiplayer Lobby
- Players spawn in corners, shooting disabled, no NPCs
- Lobby chat enabled, free sailing
- Start: 10 players → countdown, or 30s no new joins → start

### In-Match HUD
- **Top center**: Match timer (10:00 countdown)
- **Top center** (when offer): 3 upgrade cards (hotkeys 1/2/3)
- **Left panel**: Player count, level, doubloons, K/D, auto-fire toggle, FPS
- **Center top**: XP bar (doubloons to next level)
- **Right side**: Leaderboard (round + global)
- **Top right**: Kill feed (recent kills, 4s fade), wind compass
- **Bottom left**: Chat panel (player roster + chat log + input)
- **Screen edges**: Nearest player skull indicator with distance
- **Tab overlay**: Full scoreboard (current round + global standings)
- **Center**: Aim crosshair + dashed aim line when mousing for cannons

### End-of-Round Results
- 20-second results phase
- Round scoreboard (K/D/doubloons/score per player)
- Top 3 awards: Most Kills, Best K/D, Most Doubloons
- Vote panel for next round config
- Global leaderboard

### Post-Game
- "Stay in Lobby?" → Yes / No
- Yes: remain for next round. No / AFK: return to hub.

### AFK Protection
- 2 minutes no input → auto-removed

### Chat Moderation (LLM-Assisted)
- Server sends messages to moderation agent → allow/block
- Block → suppress + timeout (30s start, doubles each violation)
- Reset: 10 min clean → drop 1 escalation level
- Fallback: allow + rate-limit if service unavailable

---

## 14. Architecture Principles

### Ship-as-JSON Contract
Every ship (player or NPC) is a single JSON object. Server is authority. Client receives snapshots.
Upgrades modify this JSON via the rule engine. This is the unifying data contract across all systems.

### Module System
- `shared/` = pure logic, runs on both server and client
- `server/` = authoritative directors (NPC, upgrade, world, simulation)
- `src/` = client modules (rendering, audio, particles, input)
- `data/` = JSON descriptors (upgrades, ships, round options)

### Manager Contract
All managers follow: `init(context)`, `update(dt, context)`, `draw(ctx, context)`, `dispose(context)`.

### Data-Driven Design
- VFX, weapons, ship archetypes, upgrades all described in JSON
- Runtime managers consume and apply descriptors
- Rule engine provides traceable, deterministic upgrade application

### Testing
- Vitest for unit tests on deterministic logic
- Scenarios (this docs system) for behavior-level verification
- Dev museum pages for visual integration probes

---

## 15. Open Design Questions

These are unresolved decisions that will be addressed in future design sessions:

1. **Boss encounter tuning**: Exact HP/damage numbers, phase transition thresholds, fire trail mechanics
2. **Stage transition effects**: How dramatic should visual/audio shifts be? Do they affect gameplay (e.g. weather)?
3. **Major upgrade pool expansion**: Are 4 enough? Candidates: area-denial ability, shield/ward, chain shot, grape shot
4. **Kill credit in multi-ship fights**: Last hit vs. most damage vs. shared credit with diminishing splits
5. **Anti-snowball tuning**: How much early-kill advantage is healthy? Doubloon curves, respawn invulnerability duration
6. **Qualification rules for ranking**: Minimum matches/time to prevent small-sample exploits
7. **Score window**: Per-week, per-season, or rolling?
8. **Doubloon counting for rank**: Collected-in-round vs. held-at-round-end (held penalizes deaths more)
9. **Additional NPC types**: Ghost ships, merchant vessels, sea creatures beyond the boss kraken
10. **Meta-progression between rounds**: Should anything carry over beyond rank? Cosmetic unlocks?
