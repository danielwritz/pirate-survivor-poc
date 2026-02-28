# Pirate Survivor Prototype

Minimal browser prototype for the pirate-themed survivor game concept.

## Run
Open `index.html` directly in a browser.

Canvas now runs fullscreen in the browser viewport.

## Controls
- Steer: `A` / `D`
- Row forward: `W`
- Brake / drag anchor: `S`
- Toggle sail open/closed: `E`
- Zoom: mouse wheel
- Combat: auto-fire
- Level-up choices: `1`, `2`, `3`

## Implemented
- Momentum-based ship steering (heavier hull = more inertia)
- Wind + sail propulsion with on-screen wind compass
- Broadside-only firing from ship port/starboard weapon mounts
- Distinct gun vs cannon visual ports on ship sides
- Enemy ships use rowing + sail + wind-influenced movement like player ship
- Enemy loadouts scale with difficulty (size, gunners, cannons, cannon pivot)
- Gunners and cannons only fire when target is within effective range
- Dashed range rings around player ship show gun range (thin dashes) and cannon range (thicker dashes)
- Slower, separate reload cadence for guns vs cannons (guns faster, cannons slower)
- Floating gold drops remain at kill positions until collected
- Gold drops render as spinning pixel-style coins
- Gold pickup is the level progression resource (gold effectively acts as XP)
- World-space traversal on a larger sea map (camera follows ship)
- Land/island tiles plus translucent moving cloud layer
- Islands are larger and contain destructible village buildings
- Cannon hits destroy buildings and spawn gold fountains into the water
- Island defenses (tower cannons) activate as difficulty rises
- Boats cannot pass through islands; island impacts cause collision damage
- Islands render as pseudo-random hex/triangle patch clusters for a retro geometric look
- Procedural island generation now produces wider variety (small, long, bulky, and larger composite islands)
- Visible ship growth and ability slots
- Boats now render with more geometric pointed hulls (clearer front/bow direction)
- Hull profile changes over progression using upgrade-influenced + cosmetic variation
- Periodic boss ship spawns
- Major upgrade choices on boss defeat (visual + gameplay impact)
- Dynamic zoom-out as ship scales up
- Graphical HUD bars (hull, speed, rowing effort, threat)
- HUD includes gun and cannon loading bars with independent fill states
- Boat movement pace rebalanced much slower (projectiles remain fast)
- Vessel pace increased from the prior slow pass to a livelier midpoint
- Level configuration system with endless scaling support

## Progression Architecture
- `LEVEL_CONFIGS` defines stage parameters (`duration`, `spawnRate`, `bossEvery`, `windShift`)
- Endless mode derives additional stages automatically after defined levels
- Boss defeats increase difficulty tier and unlock major ship transformations

## Next Iteration Ideas
- Better enemy wave director and boss behaviors
- Distinct ship classes
- Persistent meta-progression
