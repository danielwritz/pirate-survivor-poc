# Pirate Survivor — Proof of Concept Design

## Vision
A pirate-themed survivor-like naval action game where a small ship grows into a floating fortress through upgrades, crew expansion, and tactical navigation.

## POC Goals
- Validate core fun loop in under 2 minutes of play.
- Prove that wind and rowing create meaningful movement strategy.
- Prove that ship growth is visually and mechanically satisfying.

## Gameplay Loop
1. Navigate hostile waters.
2. Auto-fire on nearest threats.
3. Collect gold drops (gold is the progression currency and level resource).
4. Level up and choose upgrades.
5. Survive longer against escalating enemy pressure.

## POC Mechanics
- Heading-based steering (A/D) with momentum
- Ship contact physics includes vessel-vessel separation, impulse-like speed loss, and heading disturbance on collision
- Near-shore steering includes island avoidance vectors so ships tend to steer away from landmasses before impact
- Row propulsion on demand (W)
- Sail toggle state (Space) and braking/anchor drag (S)
- Auto-shoot combat
- Enemy steering behaviors include both direct pursuit and ally-follow formation tendencies for certain ship classes
- Allied enemy subgroups can share flocking-like movement (cohesion/alignment/separation) for light formation travel
- Spawned enemy ships use varied randomized combat configurations (reload, spread, speed, battery mix) that still scale with difficulty
- Procedural weapon audio is synthesized at runtime (no file assets), with shot-to-shot variation for less repetition
- Audio spatialization blends source location and firing direction into stereo pan + front/back tone damping
- Weapon timbre scales with hull size so larger ships produce bassier fire and impact signatures
- Cannon volleys layer a subtle delayed tail/echo whose timing/intensity responds to listener distance
- SFX can be toggled in-HUD via `SFX: ON/OFF`, with user-gesture audio unlock handling for browser policies
- Recent intermittent audio crash was resolved by restoring a clean voice-chain helper and relocating cannon-tail logic to the cannon volley path
- Enemy visual identity includes sail/flag coding: shared squad palettes for allies and stripe-based flag threat markers
- Enemy archetypes:
  - Pirate skiffs (baseline)
  - Ram boats (fast impact threats)
  - Sea monsters (high-health pressure)
- Wind system with HUD compass indicator
- Graphical status HUD: hull, speed, rowing effort, and threat meter
- Reload UX:
  - Gun reload bar (faster cadence)
  - Cannon reload bar (slower cadence)
- Weapon range model:
  - Gunners fire only inside gun range
  - Cannons fire only inside cannon range
  - Dashed range circles visualize each band
- Broadside-only projectiles from side-mounted ports
- Side-mounted visual weapons:
  - Guns: smaller, lighter gray rectangles
  - Cannons: larger, darker gray rectangles
- Side mounts are sampled along hull side-edge segments with local outward normals, so weapon orientation responds dynamically to bow/shoulder/stern angle changes
- Weapon-slot assignment disperses cannons across available broadside ports as upgrades increase battery size
- Cannon muzzle direction and projectile direction are both barrel-aligned and pivot-limited for visual/mechanical consistency
- Armament caps are hull-tier/deck-size constrained (player and spawned ships) to prevent unrealistic over-gunning
- Base hull tier starts at 2 cannons per side; larger hull tiers and capacity upgrades expand this limit
- Geometric hull silhouettes with pointed bows/stern taper for stronger heading readability
- Hull profile variation includes cosmetic randomness plus stat-influenced changes from upgrades
- Heavier ship tiers increase inertia and handling weight
- Cannon Installments upgrade increases cannon capacity but adds size/mass and handling penalties (slower start, reduced turn authority)
- Ramming damage derives from impact power (speed × mass × bow alignment), making bow-first hits meaningfully stronger
- Upgrade UI surfaces cap-aware messaging so cannon upgrades clearly indicate when hull capacity is maxed
- Dynamic zoom-out as ship size increases
- Ability/upgrade choices with up to 4 active slots
- Visible ship growth over time (hull/sail transformations)
- Crew occupancy is center-deck distributed with a deck-area-based capacity ceiling that scales with ship growth
- Deck damage readability: black geometric scorch marks scale with damage for both player and enemy ships
- Weapon muzzle VFX now emit procedural polygon smoke + ember flecks (gun-small, cannon-large)
- Hit VFX now emit directional debris shards biased opposite incoming projectile direction, with larger heavy-hit spread
- Ship hits add a quick deck-burst flash/debris accent to improve impact readability
- Floating gold drops remain in-world until collected
- Gold drops render with spinning coin effect
- Large traversable sea map with camera follow
- Land/island scatter with larger geometric islands built from pseudo-random hex/triangle patches
- Islands are physically solid (boats cannot pass through land and take impact damage)
- Island generator supports shape diversity (small, long, chunky, large multi-cluster islands)
- Cannon-only building destruction with fountain-like gold bursts
- Passive islands in early game, defensive tower cannons in later tiers
- Tower batteries are range-gated to player-like cannon distance so coastal defenses feel local, not global
- Village islands include decorative dock structures and richer building shading for stronger coastal-settlement readability
- Translucent cloud pass-over layer
- Periodic boss ship arrivals that gate major progression spikes
- Boss defeat increases global difficulty tier
- Ship-size scaling also raises difficulty pressure and enemy loadout quality
- Vessel movement is intentionally slower-paced while shots remain comparatively fast
- Pace tuning can target a calmer or livelier midpoint without changing projectile tempo
- Spawn pressure and gun reload cadence are tuned to avoid overly chaotic early-screen bullet spray
- Boss fire-control checks now bias toward plausible broadside hit windows (player-first targeting, with opportunistic cross-ship collateral)
- Gold pickup includes range-based magnetic pull toward the player to reduce cleanup downtime
- Ship kills spawn short-lived geometric fireburst shards (yellow/orange/red) to emphasize impacts
- Config-driven level structure with endless scaling

## Interface Behavior
- Fullscreen canvas viewport by default
- Mouse-wheel zoom augments automatic size-based camera zoom

## Engineering Architecture (Module-First)
- Systems are designed as reusable modules so they can be lifted into other games with minimal changes.
- Runtime coordination follows manager layering:
  - `GameManager` owns frame orchestration and high-level mode flow.
  - Domain managers (combat, progression, world, VFX, audio, UI) coordinate subsystem calls.
  - Components/utilities remain focused and composable (geometry, particle generators, hull shape helpers, etc.).
- Shape and effect variants are data-driven through JSON descriptors wherever practical.
  - Example descriptor targets: VFX presets, weapon configurations, ship archetype templates, upgrade presentation metadata.
  - Managers consume descriptor data and apply it to runtime components.
- State should be created via factories and passed explicitly (context/dependency injection style) to improve long-term maintainability and testability.
- Dev museum screens serve as integration probes for modules + descriptors before shipping changes into the main game loop.

## Latest Implementation Notes (2026-03-01)
- Shipyard now has explicit `Shape/Size` and `Weapons` modes so interaction targets do not overlap.
- Hull shaping uses a triangle-body-triangle model with symmetric control handles and a dedicated stern-width scalar.
- Collector skiffs now use docked state behavior (mounted to ship sides while idle, dispatched only for collection tasks).
- Projectiles are range-limited with per-shot travel tracking; expired shots splash into water instead of flying indefinitely.
- Camera default baseline zoom is increased for a closer, more readable combat view.
- Upgrade definitions are now schema-v2 JSON rule arrays (operation based) instead of hardcoded inline `apply()` functions.
- Runtime level-up choices now consume JSON rule descriptors through a shared rule engine, improving parity with dev museum pages.
- Shared ship/armament helpers were extracted into dedicated core modules so mount/cap/sail behavior can be reused by museum managers.
- Museum pages now expose JSON inspectors for source descriptor data and live evaluated state (plus rule trace where applicable).

## Upgrade Rule Schema v2 (Current)
- Descriptor file: `data/upgrades.json`
- Top-level shape:
  - `schemaVersion`
  - `baseline` (`player`, `state`)
  - `standard[]`, `major[]`
- Each upgrade entry includes:
  - `id`, `name`, `desc`
  - `rules[]` (ordered operations)
- Core operations implemented:
  - Numeric/property ops: `set`, `add`, `mul`, `min`, `max`, `clamp`
  - Gameplay semantic ops: `autoInstallCannons`, `ensureRepairCrew`, `addAbility`
  - Hook op: `call` for manager/runtime-scoped side effects (e.g. clamping armament or ensuring skiffs)
- Rule evaluation emits an applied trace for debugging and museum inspection.

## Manager Contract Standard (AI-Agent Ready)
- Runtime managers should follow a consistent lifecycle API:
  - `init(context)`
  - `update(dt, context)`
  - `draw(ctx, context)`
  - `dispose(context)`
- `GameManager` owns orchestration order and mode flow; domain managers own feature state transitions and side-effect boundaries.
- New mechanics (example: boarding crews/fighters) should be introduced as domain managers plus config descriptors, not as ad-hoc loop blocks.
- Shared pure logic belongs in `src/core` / `src/systems`; dev museum pages should import those modules rather than fork behavior.
- Descriptor ownership lives in `data/` so runtime and museum stay synchronized from a single source-of-truth.

## Testing Baseline
- Unit tests run with Vitest (`npm test`) and target deterministic logic in `src/core` and `src/systems`.
- Required baseline coverage for new mechanics:
  - Config parsing/validation behavior.
  - Rule evaluation side-effects and traces.
  - Domain math and cap/clamp invariants.
- Museum pages remain visual integration probes; they do not replace unit tests.

## Upgrade Categories
- Offense: cannons, gunners, damage scaling
- Offense infrastructure: cannon installments (broadside capacity growth)
- Offense precision: cannon pivot/trunnion upgrades
- Mobility: rowers, sail mastery
- Defense: hull reinforcement
- Utility: future plunder magnets/repairs

## Major Upgrades (Boss Rewards)
- Dreadnought Hull
- Crimson Sails
- Grand Broadside
- Iron Ram Prow

Major upgrades are intentionally high-impact and visibly alter ship presentation.

## Visual Direction (POC)
- Pixel-art inspired top-down naval silhouette
- Readable enemy colors by type
- Tiled ocean shading + lightweight wave lines
- Semi-transparent moving cloud overlay for atmosphere

## Next Build Targets
1. Island plunder encounters
2. Better wave director and boss attack patterns
3. Distinct ship archetypes (ram, broadside, speed)
4. Meta-progression between runs
