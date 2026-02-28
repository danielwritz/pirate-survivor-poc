# Pirate Survivor Prototype

Minimal browser prototype for the pirate-themed survivor game concept.

## Run
Open `index.html` directly in a browser.

## Controls
- Steer: `A` / `D`
- Row forward: `W`
- Brake / drag anchor: `S`
- Toggle sail open/closed: `E`
- Combat: auto-fire
- Level-up choices: `1`, `2`, `3`

## Implemented
- Momentum-based ship steering (heavier hull = more inertia)
- Wind + sail propulsion with on-screen wind compass
- Broadside-only firing from ship port/starboard weapon mounts
- Distinct gun vs cannon visual ports on ship sides
- Enemy ships use rowing + sail + wind-influenced movement like player ship
- Enemy loadouts scale with difficulty (size, gunners, cannons, cannon pivot)
- Floating gold drops remain at kill positions until collected
- Gold drops render as spinning pixel-style coins
- World-space traversal on a larger sea map (camera follows ship)
- Land/island tiles plus translucent moving cloud layer
- Islands are larger and contain destructible village buildings
- Cannon hits destroy buildings and spawn gold fountains into the water
- Island defenses (tower cannons) activate as difficulty rises
- Boats cannot pass through islands; island impacts cause collision damage
- Islands render as pseudo-random hex/triangle patch clusters for a retro geometric look
- Visible ship growth and ability slots
- Periodic boss ship spawns
- Major upgrade choices on boss defeat (visual + gameplay impact)
- Dynamic zoom-out as ship scales up
- Graphical HUD bars (hull, speed, rowing effort, threat)
- Boat movement pace rebalanced much slower (projectiles remain fast)
- Level configuration system with endless scaling support

## Progression Architecture
- `LEVEL_CONFIGS` defines stage parameters (`duration`, `spawnRate`, `bossEvery`, `windShift`)
- Endless mode derives additional stages automatically after defined levels
- Boss defeats increase difficulty tier and unlock major ship transformations

## Next Iteration Ideas
- Better enemy wave director and boss behaviors
- Distinct ship classes
- Persistent meta-progression
