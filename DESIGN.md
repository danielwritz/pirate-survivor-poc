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
- Row propulsion on demand (W)
- Sail toggle state (E) and braking/anchor drag (S)
- Auto-shoot combat
- Enemy steering behaviors include both direct pursuit and ally-follow formation tendencies for certain ship classes
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
- Geometric hull silhouettes with pointed bows/stern taper for stronger heading readability
- Hull profile variation includes cosmetic randomness plus stat-influenced changes from upgrades
- Heavier ship tiers increase inertia and handling weight
- Dynamic zoom-out as ship size increases
- Ability/upgrade choices with up to 4 active slots
- Visible ship growth over time (hull/sail transformations)
- Floating gold drops remain in-world until collected
- Gold drops render with spinning coin effect
- Large traversable sea map with camera follow
- Land/island scatter with larger geometric islands built from pseudo-random hex/triangle patches
- Islands are physically solid (boats cannot pass through land and take impact damage)
- Island generator supports shape diversity (small, long, chunky, large multi-cluster islands)
- Cannon-only building destruction with fountain-like gold bursts
- Passive islands in early game, defensive tower cannons in later tiers
- Translucent cloud pass-over layer
- Periodic boss ship arrivals that gate major progression spikes
- Boss defeat increases global difficulty tier
- Ship-size scaling also raises difficulty pressure and enemy loadout quality
- Vessel movement is intentionally slower-paced while shots remain comparatively fast
- Pace tuning can target a calmer or livelier midpoint without changing projectile tempo
- Spawn pressure and gun reload cadence are tuned to avoid overly chaotic early-screen bullet spray
- Config-driven level structure with endless scaling

## Interface Behavior
- Fullscreen canvas viewport by default
- Mouse-wheel zoom augments automatic size-based camera zoom

## Upgrade Categories
- Offense: cannons, gunners, damage scaling
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
