# Pirate Survivor Prototype

Minimal browser prototype for the pirate-themed survivor game concept.

## Run
Open `index.html` directly in a browser.

## Controls
- Move: `WASD` or arrow keys
- Combat: auto-fire
- Level-up choices: `1`, `2`, `3`

## Implemented
- Top-down ship movement
- Auto-shooting at nearest enemies
- Enemy waves (pirates, rammers, sea monsters)
- Gold + XP + level-up upgrades
- Wind direction gameplay effect
- Rower upgrade mitigates wind impact
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
