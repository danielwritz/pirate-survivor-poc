# Pirate Survivor Prototype

Minimal browser prototype for the pirate-themed survivor game concept.
**Primary direction: ranked multiplayer PvPvE** (10-minute rounds, authoritative server).

## Project Direction
- Multiplayer is the target experience. Single-player serves as sandbox/practice mode.
- **Multiplayer prototype is live** — authoritative server with shared modules, full combat, NPCs, upgrades, islands.
- SP mechanics are locked; current focus is MP feature parity and visual polish.
- Forward planning lives in `ROADMAP.md`.
- Multiplayer design: `multiplayerthoughts.md` (rules/ranking) + `multiplayer_layout_and_flow.md` (UI/flow).

## Latest Session Updates (2026-03-03)

### Multiplayer Implementation (Batches A–E)
- **Authoritative server** running on Node.js + `ws` WebSocket library.
- **Shared module architecture**: `shared/constants.js`, `shared/shipState.js`, `shared/physics.js`, `shared/combat.js`, `shared/upgradeRegistry.js`, `shared/world.js` — used by both server and client.
- **Server directors**: `server/simulation.js` (tick loop), `server/npcDirector.js`, `server/upgradeDirector.js`, `server/worldManager.js`.
- **Full SP-parity combat**: mount-level gun auto-fire, click-to-aim manual cannons, ramming, fire/ignition DoT, crew-scaled mechanics.
- **Procedural world**: 24 seeded islands with buildings (destructible, gold drops), docks, tower defenses that scale with time.
- **NPC enemies**: 2 archetypes (Standard/Heavy), AI state machine, difficulty ramp (+1 upgrade/60s), doubloon rewards.
- **Upgrade progression**: XP/level system, 3-card picker (1/2/3 keys), 12 standard + 4 major upgrades, milestone majors every 5 levels.
- **Client** (`mp.html`): island rendering, NPC ships, fire overlay, explosion particles, aim crosshair, scoreboard with Lv column, level display.
- **Round lifecycle**: 10-minute timer with auto-restart and map re-seed.

### Previous SP Updates (2026-03-01)
- Starter ship presets, boss damage tuning, SFX showcase page.
- Docked skiff behavior, shipwright hull editing, stern-width scalar.
- Projectile max-range, water splash VFX, camera zoom tuning.
- Shared core modules (`shipMath.js`, `armament.js`), JSON upgrade rule engine.
- Upgrade Browser parity, Weapon/VFX inspector panes.
- Vitest unit-test harness for core ship math, armament rules, upgrade rule execution.

## Run

### Multiplayer (primary)
1. `npm install` (first time only)
2. `node server/index.js`
3. Open `http://localhost:3000` in one or more browser tabs

#### Multiplayer persistent leaderboard (SQLite)
- Leaderboard storage uses SQLite on-disk (no in-memory fallback).
- Optional env var: `LEADERBOARD_DB_PATH` (absolute or relative file path).
- Default path: `data/leaderboard.sqlite`.

### Azure App Service notes (SQLite)
- SQLite is file-based and only safe for a **single App Service instance**. Disable horizontal scale-out.
- Use a persistent App Service path for the DB file:
	- Linux App Service: `/home/data/leaderboard.sqlite`
	- Windows App Service: `D:\\home\\data\\leaderboard.sqlite`
- Set app settings:
	- `PORT=3000` (or leave platform default if already set by your runtime)
	- `LEADERBOARD_DB_PATH=/home/data/leaderboard.sqlite` (Linux example)
- Keep startup command as `npm start` (runs `node server/index.js`).
- Verify after deploy by checking app logs for `Leaderboard DB path:` and confirming it points to `/home` (Linux) or `D:\\home` (Windows).

### Single-player (sandbox)
Serve the workspace root with a local HTTP server, then open `index.html`:
- `npx serve . -l 4173`
- Open `http://localhost:4173`

### Unit tests
- `npm install`
- `npm test`

Canvas runs fullscreen in the browser viewport.

Developer museum screens are available under `dev/`.
- Start page: `dev/index.html`
- Ship Gallery: `dev/ship-gallery.html`
- Weapon/VFX screen: `dev/weapon-vfx-showcase.html`
- Upgrade Browser: `dev/upgrade-browser.html`
- Island Viewer: `dev/island-viewer.html`
- Sound Effects Showcase: `dev/sfx-showcase.html`

## Development Architecture Direction
- Build everything as reusable modules with clear, narrow APIs (`core`, `systems`, `entities`, `rendering`, `dev`).
- Prefer manager composition over giant files:
	- `GameManager` orchestrates top-level loop/state transitions.
	- Sub-managers (combat, spawning, VFX, audio, UI) act as glue between pure components.
- Define component/effect variants with JSON descriptors (data-first), then feed that data into reusable runtime modules.
- For upgrades specifically, use operation-based rule arrays (`add`, `set`, `mul`, `clamp`, `autoInstallCannons`, `ensureRepairCrew`, `addAbility`, `call`) to keep gameplay and museum behavior aligned.
- Keep mutable state inside manager/state factories rather than hidden globals to support testing and reuse.
- Use museum pages under `dev/` as visual tests for modules and descriptors before integrating into main gameplay.
- Standardize manager APIs for AI-agent implementation work:
	- `init(context)` for setup and dependency binding.
	- `update(dt, context)` for deterministic gameplay state transitions.
	- `draw(ctx, context)` for render-only behavior.
	- `dispose(context)` for cleanup and teardown.
- Treat `data/` as canonical descriptor source for runtime + dev museum; avoid duplicating gameplay descriptor logic in page scripts.

## Controls

### Shared (SP + MP)
- Steer: `A` / `D`
- Row forward: `W`
- Brake / drag anchor: `S`
- Toggle sail: `Space`
- Level-up choices: `1`, `2`, `3`

### Multiplayer
- Fire cannons: **Click** (toward mouse cursor)
- Guns: auto-fire when enemies in broadside arc
- Scoreboard: hold `Tab`
- Chat: `Enter` to type, `Enter` to send
- Villages debug overlay: HUD `Villages DBG` button (shows building bounds/IDs and village cluster count)

### Single-player only
- Toggle SFX: HUD button
- Zoom: mouse wheel
- Combat: auto-fire

## Implemented
- Momentum-based ship steering (heavier hull = more inertia)
- Ship-to-ship collisions now use physical separation + momentum transfer instead of simple overlap drain
- Ramming/impact damage now scales by speed, mass, and bow-on contact angle
- Wind + sail propulsion with on-screen wind compass
- Broadside-only firing from ship port/starboard weapon mounts
- Distinct gun vs cannon visual ports on ship sides
- Gun/cannon ports sample the actual hull side-edge polyline and orient to local outward normals
- Cannon visuals show live pivoting toward target side, and cannon shots follow those barrel directions
- Armament is hull-limited: guns and cannons are capped by ship deck size/tier
- Base hull tier supports up to 2 cannons per side; larger hull tiers and upgrades unlock higher capacity
- Generated enemy ships also obey hull-size armament caps to keep loadouts believable
- Enemy sail/flag palettes are more varied for stronger visual variety
- Same-squad enemies share sail/flag palette colors to show allied grouping
- Flag stripe count indicates enemy threat tier at a glance
- New upgrade option: Cannon Installments (raises cannon capacity per side, adds hull weight/inertia)
- Heavier ships now have stronger momentum penalties (slower start and weaker turning authority)
- HUD shows armament as current/max (`Guns a/b`, `Cannons c/d per side`) plus ship tier
- Upgrade cards now warn when `Cannons` is at hull cap and point to `Cannon Installments`
- Gunners and cannons only fire when target is within effective range
- Bosses now hold fire until a broadside solution is likely to connect; they prioritize the player but can opportunistically blast other ships in their arc
- Dashed range rings around player ship show gun range (thin dashes) and cannon range (thicker dashes)
- Slower, separate reload cadence for guns vs cannons (guns faster, cannons slower)
- Procedural retro weapon SFX engine (no external audio files) with randomized shot variation
- Directional 2D weapon audio uses source position + firing direction for stereo/front-back feel
- Gun voleys are short, lower-pitched, and less bass-heavy; cannon volleys are deeper and heavier
- Cannon volleys include a subtle distance-shaped echo tail for extra weight at range
- Sound profile scales with ship size so larger hulls sound bassier
- HUD includes a live SFX mute/unmute toggle; audio unlock handled on user interaction
- Audio runtime crash from enemy SFX path was fixed by correcting the cannon echo/voice-chain wiring
- Global gun reload cadence tuned slower to reduce early bullet noise
- Gold inside player gun-range radius now magnet-pulls toward the player for faster collection flow
- Gold drops render as spinning pixel-style coins
- Ship deaths now spawn geometric yellow/orange/red fiery explosion shards
- Weapon fire now emits generated polygon muzzle smoke and warm blast flecks (smaller for guns, larger for cannons)
- Hits now spawn directional impact debris polygons with ship/deck-like color mixes plus quick deck-hit burst accents
- Gold pickup is the level progression resource (gold effectively acts as XP)
- World-space traversal on a larger sea map (camera follows ship)
- Land/island tiles plus translucent moving cloud layer
- Islands are larger and contain destructible village buildings
- Cannon hits destroy buildings and spawn gold fountains into the water
- Island defenses (tower cannons) activate as difficulty rises
- Island defenses now only fire inside player-cannon-like engagement range (no map-wide sniping)
- Boats cannot pass through islands; island impacts cause collision damage
- Enemy ships can now collide with each other and with the player, producing contact slowdowns and impact damage
- Player and enemy helms now apply shoreline-avoidance steering pressure before impact to reduce accidental beaching
- Player and enemy decks now show accumulating dark geometric damage scars as hull health drops
- Village islands now include decorative wooden docks that improve readability without blocking ship movement
- Island settlements have richer geometric structure art (shadows, roof bands, and window details)
- Islands render as pseudo-random hex/triangle patch clusters for a retro geometric look
- Procedural island generation now produces wider variety (small, long, bulky, and larger composite islands)
- Visible ship growth and ability slots
- Crew pips are center-deck distributed and crew size is now capped by deck capacity that scales with hull size
- Boats now render with more geometric pointed hulls (clearer front/bow direction)
- Hull profile changes over progression using upgrade-influenced + cosmetic variation
- Removed extra beige bow marker triangles from ships to keep silhouettes cleaner
- Periodic boss ship spawns
- Major upgrade choices on boss defeat (visual + gameplay impact)
- Dynamic zoom-out as ship scales up
- Graphical HUD bars (hull, speed, rowing effort, threat)
- HUD includes gun and cannon loading bars with independent fill states
- HUD now also shows current gun and cannon counts
- Boat movement pace rebalanced much slower (projectiles remain fast)
- Vessel pace increased from the prior slow pass to a livelier midpoint
- Level configuration system with endless scaling support

## Progression Architecture
- `LEVEL_CONFIGS` defines stage parameters (`duration`, `spawnRate`, `bossEvery`, `windShift`)
- Endless mode derives additional stages automatically after defined levels
- Boss defeats increase difficulty tier and unlock major ship transformations

## Next Up
- **Batch F**: Visual polish — hull shape rendering, particle system, procedural audio, fog of war, camera zoom.
- **Batch G**: Round lifecycle — results screen, auto-rank, spectator mode.
- Full roadmap and checklist: `ROADMAP.md`.
