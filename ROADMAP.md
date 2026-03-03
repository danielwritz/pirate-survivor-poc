# Pirate Survivor Roadmap

This is the canonical forward-looking roadmap for the project.

- **Direction**: multiplayer-first (ranked PvPvE is the target experience).
- Scope style: simple, readable gameplay first.
- Rule: future roadmap changes should be made here (not duplicated in `README.md` or `DESIGN.md`).
- Multiplayer design docs: `notes/multiplayerthoughts.md` (rules/ranking) and `notes/multiplayer_layout_and_flow.md` (UI/flow).

---

## Product Pillars

### 1) Clear, Responsive Visuals
- Keep visuals polygon-first and readable at a glance.
- Maintain a clear global draw layering model (world, ships, crew, effects, overlays).
- Upgrades must be visually represented in-run (new cannons, crew presence, deck/ship growth).

### 2) Simple Upgrade Language
- Upgrade names should be short, obvious, and role-first.
- Themed names are welcome only if effect clarity is immediate.
- Keep descriptions concise and explicit about impact.

### 3) Meaningful Upgrade Feedback
- If a player picks a combat/crew/ship upgrade, that change should be visible on the ship and in behavior.
- Fewer text-heavy upgrade concepts; stronger visual and mechanical identity.

### 4) Multiplayer as Primary Mode
- Single-player is the sandbox/practice mode; ranked multiplayer is the core experience.
- All gameplay mechanics (upgrades, combat, NPCs) must work in a 10-minute PvPvE match context.
- Authoritative server architecture (Node/Bun + WebSocket) for competitive integrity.

---

## Status Update (2026-03-03)
- ✅ Multiplayer design docs consolidated and de-duplicated.
- ✅ Core multiplayer decisions locked: equal starts, in-round upgrades, PvPvE, procedural maps, 20% doubloon drop on death, ramping NPCs, authoritative server.
- ✅ Canonical roadmap consolidated in this file.
- ✅ Upgrade naming/copy simplification pass started in runtime upgrade descriptors.
- ✅ Starter preset armament baseline aligned to one cannon per side plus guns.
- ✅ First-run starter screen removed: game now drops directly into combat with starter ship preset.
- ✅ Collision/combat readability pass landed.
- ✅ Visibility fantasy pass landed (fog-of-war + Crow's Nest).
- ✅ Visual feedback pass landed (material tiers + sail rig).
- ✅ Phase 2 Steps 1–3 shipped: authoritative server, WebSocket sync, basic combat scaffold.
- ✅ **Batch A–E (server-side) complete**: Shared module architecture, full combat, world gen, upgrades, NPCs — all running on server.
- ✅ **Client updated**: Islands, NPC ships, cannon click-to-aim, upgrade picker UI, fire FX, level display, explosion FX, aim crosshair.
- 🔄 Client visual polish (Batch F) not started — ships render with a simple hull polygon, not the full SP hull-shape system.
- 🔄 Audio, fog-of-war, particles, and round results screen not yet ported to MP client.

---

## Current Gameplay Rules to Preserve (for now)
- Upgrade cadence remains XP/gold-driven.
- Crew capacity remains in current scale model (no large cap jump in this phase).
- Ship starts with guns plus one cannon per side.
- Cannon capacity expansion remains in the in-run upgrade pool.
- These rules transfer directly to multiplayer rounds (everyone starts equal, earns upgrades in-round).

---

## Phase 1: Solidify Single-Player Mechanics (Current)

> Goal: lock the upgrade/combat/NPC feel before building multiplayer on top of it.

### Playtesting and Tuning
- Continue playtesting single-player loop for upgrade balance, NPC scaling feel, and combat pacing.
- Capture specific tuning notes after sessions.
- Validate that the 10-minute mark in single-player feels like a complete arc (this directly informs ranked round pacing).

### Visual Clarity and Layer Contract
- Document and standardize practical global draw layers used during gameplay.
- Ensure key entities (ship, crew, cannons, skiffs, loot, hazards) remain readable under motion and overlap.

### Upgrade Naming and Copy Pass
- Simplify upgrade naming around obvious role/action language.
- Tighten descriptions to crystal-clear one-line outcomes.
- Status: ✅ In progress (initial descriptor pass landed).

### Crew and Armament Representation
- Clarify crew budget behavior tied to ship size.
- Ensure cannon capacity progression reads clearly in upgrade choices.
- Status: ✅ Starter loadout baseline updated; deeper crew-budget UX still pending.

### Pirate Fantasy Encounters (First Set)
- Village auto-raids with skiffs.
- Treasure map encounter with dashed path guidance.
- Treasure chest encounter/reward moments.

---

## Phase 2: Multiplayer Vertical Slice (v1)

> Goal: one server, one game, connect and play. No lobby browser, no matchmaking, no hub UI.
> Every step must be independently testable and playable. Gate question at each step: **"Is this fun? How does this make the game more fun?"**

### v1 target experience
- You connect, you're in the game. Sail around, fight, collect gold, upgrade.
- Round auto-restarts every 10 minutes with brief results. Auto-computed rank in scoreboard.
- Chat works in-game. If >10 players, extras wait in chat-only spectator mode (can watch the live round and chat into the game).

### Step 1: Server + one client ✅
- Authoritative game server (Node + ws) with WebSocket transport.
- Server runs game sim; client sends inputs, receives state, renders.

### Step 2: Two clients see each other ✅
- Position sync + interpolation for remote players.

### Step 3: Basic combat across clients ✅ (scaffold → replaced)
- Original scaffold replaced by full SP-parity combat in Batch A–C.
- Mount-level guns/cannons, ramming, fire/ignition, crew-scaled mechanics all running.

### Step 3b: Chat ✅
- Text input broadcast to all connected clients. Working since Step 2.

---

## SP Feature Parity — Architecture & Implementation Plan

> **Goal**: Port all single-player gameplay systems to multiplayer with a modular,
> data-driven architecture. Ships are JSON. Upgrades are modifiers. Systems are
> modules that interface through shared data, not hard coupling.
>
> **Rule**: Server is authoritative for all game state. Client receives state +
> events, renders visuals and plays effects. Some effects (particles, audio,
> screen shake) are client-only but triggered by server events.

### Architecture: Module System

```
shared/          ← runs on BOTH server and client (pure logic, no DOM/canvas)
  shipState.js       Ship-as-JSON schema, factory, derived stat calculator
  upgradeRegistry.js Upgrade catalog + rule engine (from data/upgrades.json)
  combat.js          Broadside logic, bullet physics, damage formulas, fire/ignite
  physics.js         Ship movement, wind, collisions, ramming
  world.js           Island/building generation, building HP, tower logic
  constants.js       All tuning knobs (shared between server & client)

server/
  simulation.js      Main tick loop, orchestrates directors
  npcDirector.js     NPC spawning, AI (seek/broadside/unstick), difficulty scaling
  upgradeDirector.js XP/level tracking, upgrade offers, server-side apply
  worldManager.js    Island/building state, tower firing schedule
  index.js           HTTP + WebSocket server (already exists)

client/
  renderer.js        Canvas draw pipeline (layers: water → islands → ships → fx → HUD)
  shipRenderer.js    Hull shape, weapons, sail, armor tier, fire overlay, upgrades
  particleSystem.js  Muzzle blast, debris, wake, explosions, building fire
  audioSystem.js     Procedural spatial SFX (guns, cannons, impacts)
  fogOfWar.js        Vision mask, Crow's Nest range
  inputManager.js    Keyboard + mouse, cannon aim (click-to-broadside)
  hudManager.js      Timer, stats, upgrade cards, aim reticle, range circles
  upgradeUI.js       Non-intrusive top-of-screen 3-choice picker (game keeps playing)
```

### Ship-as-JSON Contract

Every ship (player or NPC) is a single JSON object. The server is the authority.
Client receives a snapshot each tick. Upgrades are modifiers applied to the JSON.

```jsonc
{
  // Identity
  "id": 42, "name": "Blackbeard", "isNpc": false,

  // Position / motion
  "x": 1200, "y": 800, "heading": -1.57, "speed": 0,

  // Stats (baseline + upgrade deltas)
  "size": 16, "mass": 28, "baseSpeed": 2.6,
  "maxHp": 20, "hp": 20,
  "gunReload": 1.35, "cannonReload": 3.4,
  "bulletDamage": 9, "rudder": 0,
  "rowers": 0, "gunners": 2, "repairCrew": 0, "crew": 2,
  "cannonCapacityBonus": 0, "cannonPivot": 0,
  "lookoutRangeBonus": 0, "hullArmorTier": 0,
  "ram": false, "ramDamage": 46,

  // Hull shape (drives visual + deck area + weapon caps)
  "hullLength": 1, "hullBeam": 1, "bowSharpness": 1, "sternTaper": 1,

  // Weapons (slot-level layout)
  "weaponLayout": { "port": ["gun","cannon","empty"], "starboard": ["gun","cannon","empty"] },

  // Visuals (derived from upgrades)
  "hullColor": "#5f4630", "trimColor": "#d9b78d",
  "sailColor": "#f0f7ff", "mastScale": 1,
  "sailOpen": true,

  // State flags
  "alive": true, "invulnTimer": 0,
  "onFire": false, "fireTicks": 0,

  // Applied upgrades (ordered list of IDs)
  "upgrades": ["crew-musketeers", "cannons", "reinforced-hull"],

  // Economy (players only)
  "doubloons": 0, "kills": 0, "deaths": 0, "level": 1, "xp": 0
}
```

### SP Feature Parity Checklist

Each feature below maps to a system module. Status key:
- ✅ = done in MP  |  🔄 = partially done  |  ⬜ = not started  |  ✂ = cut from MP

| # | Feature | Module | Status | Notes |
|---|---------|--------|--------|-------|
| **Combat** | | | | |
| 1 | Mount-level weapon layout (gun/cannon slots per side) | `shared/combat.js` | ✅ | Slot count from hull shape via `getShipWeaponCaps`. Layout per side in ship JSON. |
| 2 | Gun auto-fire (broadside, pivot ±30°, per-mount reload) | `shared/combat.js` | ✅ | Per-mount with crew efficiency, LOS via `getHullSideMount`, pivot arc check. |
| 3 | Manual cannon fire (click-to-aim, per-mount + volley cooldown) | `shared/combat.js` + `mp.html` | ✅ | Client sends aim angle on click; server fires matching-side cannons. Volley cooldown. |
| 4 | Bullet physics (speed, range, heavy/light, damage scaling) | `shared/combat.js` | ✅ | Per-upgrade damage, gun vs cannon scaling (0.18 / 0.28), crew efficiency affects reload. |
| 5 | Ramming (bow-dot collision, ram damage, impact cooldown) | `shared/physics.js` | ✅ | Bow-dot > 0.5 triggers ram. RAM_MULTIPLIER=1.55, self-reduction=0.24. Impact cooldown. |
| 6 | Ship fire/ignition (cannon hit → chance to ignite, DoT) | `shared/combat.js` | ✅ | Server sets `onFire`; client renders animated flame overlay. DoT ticks 0.2s interval. |
| 7 | Passive repair (crew-based HP regen, suppress on hit) | `shared/combat.js` | ✅ | Crew-scaled rate, movement reduces repair, 2.4s suppression on damage. |
| **World** | | | | |
| 8 | Procedural island generation (24 islands, shapes, patches) | `shared/world.js` | ✅ | Seeded RNG (mulberry32). 3 size classes, 8–12 point irregular outlines. |
| 9 | Buildings on islands (HP, size, position) | `shared/world.js` | ✅ | Server tracks HP. Client renders damage state + HP bars. |
| 10 | Building destruction + gold drops | `server/worldManager.js` | ✅ | Weapon-type scaling (cannon 1.05x, gun 0.58x). Gold scatter on destroy. |
| 11 | Island tower defenses (fire at players, scale with difficulty) | `server/worldManager.js` | ✅ | Tower chance + fire rate + damage scale with defense tier (every 90s). |
| 12 | Island collision (slow + damage on contact) | `server/worldManager.js` | ✅ | Speed → 25%, push away from center, contact damage based on mass. |
| 13 | Docks (visual, per-island) | `shared/world.js` + `mp.html` | ✅ | Generated per-island (1–3), rendered as brown piers in client. |
| **NPCs** | | | | |
| 14 | 2 enemy archetypes: standard + heavy | `server/npcDirector.js` | ✅ | Standard (70%) and Heavy (30%, 1.25x size, 2.1x HP, 0.85x speed). |
| 15 | NPC AI: player-seeking with broadside engagement | `server/npcDirector.js` | ✅ | approach → broadside → fire → unstick state machine. |
| 16 | NPC spawn off-screen, seek nearest player | `server/npcDirector.js` | ✅ | Edge spawn, picks position farthest from all players. |
| 17 | Difficulty scaling (time → more NPC upgrades) | `server/npcDirector.js` | ✅ | +1 random upgrade per 60s of round time. Spawn rate increases. |
| 18 | NPC doubloon reward (scales with upgrade count) | `server/npcDirector.js` | ✅ | Reward = 3 + upgradeCount×2. XP awarded to killer. |
| **Upgrades** | | | | |
| 19 | Upgrade registry (12 standard + 4 major from upgrades.json) | `shared/upgradeRegistry.js` | ✅ | Wraps `upgradeRuleEngine.js`. MP env hooks for auto-install, armor tiers. |
| 20 | XP / level system (gold collected = XP, scaling thresholds) | `server/upgradeDirector.js` | ✅ | `xpToNext = floor(prev * 1.3 + 5)`, starting at 10. Gold pickup + kills = XP. |
| 21 | Level-up → offer 3 random standard upgrades | `server/upgradeDirector.js` | ✅ | Server rolls 3, sends `upgradeOffer` event. Client shows 3-card picker. |
| 22 | Milestone → offer 3 major upgrades | `server/upgradeDirector.js` | ✅ | Every 5 levels triggers major offer. |
| 23 | Server-side upgrade application (modify ship JSON) | `server/upgradeDirector.js` | ✅ | `applyUpgrade()` runs rule engine + env hooks, broadcasts via state snapshot. |
| 24 | Upgrade UI: non-intrusive top-of-screen 3-choice cards | `mp.html` | ✅ | 3 cards at top of screen. Click or press 1/2/3. Game keeps playing. |
| 25 | Remove salvage-skiffs from MP upgrade pool | `shared/upgradeRegistry.js` | ✅ | Filtered in `buildMpCatalog()`. |
| **Visuals (upgrade-driven)** | | | | |
| 26 | Hull armor tiers (color progression, plate lines at T4) | `mp.html` | 🔄 | Server sends `hullArmorTier` + colors. Client renders hull color but not plate-line detail. |
| 27 | Hull shape changes from upgrades (length, beam, bow, stern) | `mp.html` | 🔄 | Ship JSON has shape fields; client hull is simple polygon (not using `getHullShape()`). |
| 28 | Sail color / mast scale changes (e.g. Crimson Sails) | `mp.html` | ✅ | Client reads `sailColor` and `mastScale` from ship snapshot. |
| 29 | Weapon mount visuals (gun/cannon dots on hull perimeter) | `mp.html` | ⬜ | Data is sent (`weaponLayout`); rendering not yet implemented. |
| 30 | Ship fire overlay (flame triangles on burning ships) | `mp.html` | ✅ | Animated flame particles over hull when `onFire` is true. |
| **Effects** | | | | |
| 31 | Muzzle blast particles (smoke puffs, embers) | — | ⬜ | |
| 32 | Impact debris (hull splinters, water settle) | — | ⬜ | |
| 33 | Vessel wake (speed-scaled stern bands + bow splash) | — | ⬜ | |
| 34 | Ship explosion (colored shards on death) | `mp.html` | 🔄 | Simple expanding circle on NPC death. Not full SP shard system. |
| 35 | Building fire/damage FX | — | ⬜ | Buildings show HP bar but no fire particles. |
| 36 | Cloud overlay (wind-driven drift) | — | ⬜ | |
| **Audio** | | | | |
| 37 | Gun volley SFX (procedural, spatial) | — | ⬜ | SP `audioSystem.js` exists but not wired to MP client. |
| 38 | Cannon volley SFX (bass boom, spatial) | — | ⬜ | |
| 39 | Impact SFX (gun crack, cannon thud) | — | ⬜ | |
| **Navigation** | | | | |
| 40 | Wind system (periodic shift, sail alignment) | `shared/physics.js` | ✅ | Full SP model: sail push with wind alignment, rower-based wind resistance. |
| 41 | Rowing (crew-based acceleration) | `shared/physics.js` | ✅ | Rower count scaling, separate player/NPC accel bases. |
| 42 | Anchor (toggle, speed=0) | `shared/physics.js` | ✅ | Full SP behavior. |
| **HUD / Camera** | | | | |
| 43 | Fog of war / vision mask (Crow's Nest range) | — | ⬜ | |
| 44 | Camera zoom tied to Crow's Nest level | — | ⬜ | Fixed zoom=2 currently. |
| 45 | Aim reticle + cannon range/gun range circles | `mp.html` | 🔄 | Crosshair + dashed aim line exist. Range circles not yet drawn. |
| 46 | HP bar, reload bars, stats line | `mp.html` | 🔄 | HP bar + level + doubloons + K/D shown. No reload bars yet. |
| **Round lifecycle** | | | | |
| 47 | 10-min round timer + auto-restart | `server/simulation.js` | ✅ | Timer counts down, `resetRound()` re-seeds world, resets all players. |
| 48 | Results screen (top kills, K/D, doubloons) | — | ⬜ | |
| 49 | Scoreboard (Tab overlay, live K/D/doubloons/level) | `mp.html` | ✅ | Tab overlay with Lv, K, D, doubloons, HP columns. |
| 50 | Auto-rank + league tier display | — | ⬜ | |
| 51 | Queue cap + spectator mode (>10 players) | — | ⬜ |

### Cut from MP (explicit)
- ✂ Salvage skiffs / auto-loot boats
- ✂ Shipyard / hull refit system
- ✂ Hull shape editing (5 drag handles)
- ✂ Crew visuals on deck (animated figures)
- ✂ Starter preset selection screen

---

## Implementation Batches

Each batch is independently testable. Ship JSON is the unifying data contract
that lets batches compose cleanly.

### Batch A: Architecture Foundation ✅
> Extract shared modules from SP monolith. Establish the ship-as-JSON contract.

1. ✅ `shared/shipState.js` — ship factory, derived stat calculators (ranges, crew efficiency, repair rate, vision), `shipSnapshot()` for network.
2. ✅ `shared/upgradeRegistry.js` — wraps `upgradeRuleEngine.js`, filters salvage-skiffs, MP env hooks (auto-install weapons, armor tier colors).
3. ✅ `shared/physics.js` — full SP movement model (crew-scaled rowing, sail push, wind resistance, steering with inertia, anchor, world clamp).
4. ✅ `shared/combat.js` — mount-level broadside (gun auto-fire + cannon manual fire), bullet physics, damage scaling, fire/ignition DoT, crew-based repair.
5. ✅ `shared/constants.js` — 100+ tuning values, single source of truth.
6. ✅ `server/simulation.js` — director-based orchestrator importing all shared modules + server directors.

**Playtest gate**: ✅ Server works with modular architecture. All SP combat/physics running.

### Batch B: World Generation + Islands ✅
> Procedural islands with buildings, collision, and tower defenses.

7. ✅ `shared/world.js` — seeded generation (24 islands, irregular outlines, buildings, docks, foliage).
8. ✅ `server/worldManager.js` — building HP tracking, weapon-type damage scaling, gold drops on destroy, tower firing.
9. ✅ Island collision in simulation (slow + push + damage on contact).
10. ✅ Client (`mp.html`): renders island polygons, buildings (with HP bars + destroyed state), docks, foliage, tower indicators.

**Playtest gate**: ✅ *Playable* — islands visible, buildings destructible, towers fire, gold drops from rubble.

### Batch C: Full Combat System ✅
> Replace scaffold combat with mount-level weapons, manual cannons, ramming, fire.

11. ✅ Mount-level weapon layout: gun/cannon slots from `getShipWeaponCaps()` + hull shape.
12. ✅ Gun auto-fire: per-mount reload, crew efficiency, side detection, broadside arc check, `getHullSideMount()` positions.
13. ✅ Manual cannon fire: client click → `cannonFire` message with aim angle → server fires matching-side cannons. Volley cooldown.
14. ✅ Ramming: bow-dot collision, `ram` flag, RAM_MULTIPLIER, self-reduction, impact cooldown.
15. ✅ Ship fire/ignition: cannon hit → chance-based ignite, DoT ticks, duration. Client renders fire overlay.
16. ✅ Crew-scaled mechanics: reload efficiency, repair rate, rowing power, wind resistance — all crew-count-driven.

**Playtest gate**: ✅ *Playable* — click to aim cannons, ram enemies, ships catch fire.

### Batch D: Upgrades + Progression ✅
> Full upgrade loop running in multiplayer rounds.

17. ✅ XP/level system: gold pickup + kills = XP, scaling thresholds.
18. ✅ Level-up → server offers 3 random standard upgrades via `upgradeOffer` event.
19. ✅ Every 5 levels → server offers 3 major upgrades.
20. ✅ Server applies upgrade rules to ship JSON via `applyUpgrade()`, broadcasts new state in next tick.
21. ✅ Client: 3-card picker at top of screen, game keeps playing. Press 1/2/3 or click.
22. 🔄 Upgrade visuals partially working: hull color + sail color + size growth work. Weapon mount dots + plate lines not rendered yet.

**Playtest gate**: ✅ *Playable* — level up, pick upgrades, ship stats change. Visual representation still basic.

### Batch E: NPCs + Difficulty ✅
> PvPvE with escalating NPC pressure.

23. ✅ 2 archetypes: Standard (70%, normal stats) and Heavy (30%, 1.25x size, 2.1x HP, 0.85x speed).
24. ✅ NPC AI: approach → broadside (perpendicular positioning, auto-fire cannons) → unstick (hard turn + row).
25. ✅ NPC spawning: edge spawn far from players, interval decreases with time. Difficulty = +1 upgrade/60s.
26. ✅ NPC rewards: doubloon reward = 3 + upgradeCount×2. Loot scatters on death.
27. ✅ NPC ships use same ship-as-JSON + shared combat. Client renders them identically to players.

**Playtest gate**: ✅ *Playable* — NPCs roam, seek players, fight broadside, drop loot. Difficulty ramps.

### Batch F: Visual Polish + Effects ⬜ (Next)
> Full SP-quality rendering for the multiplayer client.

28. ⬜ Ship renderer: use `getHullShape()` for accurate hull polygon, weapon mount visuals, armor tier plate lines.
29. ⬜ Particle system: muzzle blast, impact debris, wake, explosions, building fire.
30. ⬜ Procedural audio: port SP `audioSystem.js` for gun/cannon volley, impact SFX, spatial positioning.
31. ⬜ Fog of war / vision mask (Crow's Nest range).
32. ⬜ Camera zoom tied to Crow's Nest level (currently fixed zoom=2).
33. 🔄 Aim reticle + range indicator circles (crosshair exists; range circles not drawn).
34. ⬜ Clouds, ambient water effects.

**Playtest gate**: Game looks and sounds like the SP version. *"Does it feel polished?"*

### Batch G: Round Lifecycle + Meta ⬜
> Complete the competitive loop.

35. ✅ Round timer + auto-restart with new procedural map (server-side done).
36. ⬜ Brief results screen between rounds.
37. ⬜ Auto-rank + league tier at round end.
38. ⬜ Queue cap: >10 players → spectator with chat.

**Playtest gate**: Full 10-minute competitive loop. *"Is this the game?"*

---

## Phase 3: Multiplayer Polish

> Goal: flesh out the experience after SP parity is achieved.

### Lobby and Flow
- Pre-round phase: players sail freely, no shooting, no NPCs. Countdown to start.
- "Stay in Lobby?" post-round prompt.
- AFK detection and removal (2 min inactivity).

### Chat Moderation
- LLM-assisted auto-moderation with timeout escalation.
- See `notes/multiplayer_layout_and_flow.md` section 7 for full spec.

### Ranking Pipeline
- Percentile calculation across active population.
- Weekly ranking periods.
- Qualification rules (min matches to rank).

---

## Phase 4: Meta and Polish

### Cosmetic Titles
- 4 v0 titles with active/inactive variants.
- Unlock on reaching tier + staying for a full week.

### Main Hub UI
- Title screen → Main Hub with Quick Join, Server Browser, Single Player.
- Global chat room, profile, friends/ignore lists.

### Later
- Captain unlock economy between stages.
- Stage/environment/theme unlock progression.
- Additional pirate-fantasy encounters (ghost ship, kraken, expanded raid events).
- Anti-cheat hardening.
- Spectator mode enhancements (free camera, player follow, kill feed).
- Potential migration of some in-run upgrades to between-run meta progression.

---

## Out of Scope in This Phase
- Salvage skiffs / auto-loot boats (cut for MP).
- Shipyard / hull shape editing (cut for MP — upgrades are the only modification path).
- Crew visuals on deck (cut for MP).
- Pre-match loadout/build customization (everyone starts equal).
- Multiple servers / server browser (v1 is one server, one game).
- Large crew-capacity rebalance.
- Complex art-pipeline expansion beyond polygon layering.
