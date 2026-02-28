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
- Enemy waves (pirates, rammers, sea monsters)
- Floating gold drops remain at kill positions until collected
- World-space traversal on a larger sea map (camera follows ship)
- Land/island tiles plus translucent moving cloud layer
- Visible ship growth and ability slots
- Periodic boss ship spawns
- Major upgrade choices on boss defeat (visual + gameplay impact)
- Level configuration system with endless scaling support

## Progression Architecture
- `LEVEL_CONFIGS` defines stage parameters (`duration`, `spawnRate`, `bossEvery`, `windShift`)
- Endless mode derives additional stages automatically after defined levels
- Boss defeats increase difficulty tier and unlock major ship transformations

## Next Iteration Ideas
- Islands/plunder encounters
- Better enemy wave director and boss behaviors
- Distinct ship classes
- Persistent meta-progression
