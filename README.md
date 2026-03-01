# Pirate Survivor Prototype

Minimal browser prototype for the pirate-themed survivor game concept.

## Run
Open `index.html` directly in a browser.

Canvas now runs fullscreen in the browser viewport.

## Controls
- Steer: `A` / `D`
- Row forward: `W`
- Brake / drag anchor: `S`
- Toggle sail open/closed: `Space`
- Zoom: mouse wheel
- Combat: auto-fire
- Level-up choices: `1`, `2`, `3`

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
- Global gun reload cadence tuned slower to reduce early bullet noise
- Gold inside player gun-range radius now magnet-pulls toward the player for faster collection flow
- Gold drops render as spinning pixel-style coins
- Ship deaths now spawn geometric yellow/orange/red fiery explosion shards
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

## Next Iteration Ideas
- Better enemy wave director and boss behaviors
- Distinct ship classes
- Persistent meta-progression
