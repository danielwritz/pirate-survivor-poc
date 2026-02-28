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
3. Collect gold and XP from defeated enemies.
4. Level up and choose upgrades.
5. Survive longer against escalating enemy pressure.

## POC Mechanics
- Heading-based steering (A/D) with momentum
- Row propulsion on demand (W)
- Sail toggle state (E) and braking/anchor drag (S)
- Auto-shoot combat
- Enemy archetypes:
  - Pirate skiffs (baseline)
  - Ram boats (fast impact threats)
  - Sea monsters (high-health pressure)
- Wind system with HUD compass indicator
- Broadside-only projectiles from side-mounted ports
- Side-mounted visual weapons:
  - Guns: smaller, lighter gray rectangles
  - Cannons: larger, darker gray rectangles
- Heavier ship tiers increase inertia and handling weight
- Ability/upgrade choices with up to 4 active slots
- Visible ship growth over time (hull/sail transformations)
- Floating gold drops remain in-world until collected
- Large traversable sea map with camera follow
- Land/island scatter and translucent cloud pass-over layer
- Periodic boss ship arrivals that gate major progression spikes
- Boss defeat increases global difficulty tier
- Config-driven level structure with endless scaling

## Upgrade Categories
- Offense: cannons, gunners, damage scaling
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
