# Pirate Survivor Roadmap

This is the canonical forward-looking roadmap for the project.

- Horizon: next 1-2 work sessions
- Scope style: simple, readable gameplay first
- Rule: future roadmap changes should be made here (not duplicated in `README.md` or `DESIGN.md`)

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

## Status Update (2026-03-02)
- ✅ Canonical roadmap consolidated in this file.
- ✅ `README.md` and `DESIGN.md` now point to this roadmap for forward planning.
- ✅ Upgrade naming/copy simplification pass started in runtime upgrade descriptors.
- ✅ Starter preset armament baseline aligned to one cannon per side plus guns.
- ✅ First-run starter screen removed: game now drops directly into combat with starter ship preset.
- ✅ Initial collision/combat readability pass landed: stronger ship separation, ram-heavy impacts, fracture marks, and cannon ignition burn damage.
- ✅ Visibility fantasy pass landed: limited sight radius with clouded fog-of-war and stackable Crow's Nest vision upgrade.
- ✅ Visual feedback pass landed: hull health upgrades now advance ship material tiers (wood→copper→bronze→iron→menacing iron dashes), plus a new wind-facing rectangular sail rig.
- 🔄 Next in progress: visual layer contract write-up and first pirate fantasy encounter tasks.

## Current Gameplay Rules to Preserve (for now)
- Upgrade cadence remains XP/gold-driven.
- Crew capacity remains in current scale model (no large cap jump in this phase).
- Ship starts with guns plus one cannon per side.
- Cannon capacity expansion remains in the in-run upgrade pool.

## Next 1-2 Sessions

### Visual Clarity and Layer Contract
- Document and standardize practical global draw layers used during gameplay.
- Ensure key entities (ship, crew, cannons, skiffs, loot, hazards) remain readable under motion and overlap.

### Upgrade Naming and Copy Pass
- Simplify upgrade naming around obvious role/action language (crew, gunners/flintlocks, rowers, cannoneers, hull).
- Tighten upgrade descriptions to crystal-clear one-line outcomes.
- Keep existing upgrade pool mechanics, but reduce wording ambiguity.
Status: ✅ In progress (initial descriptor pass landed).

### Crew and Armament Representation
- Clarify crew budget behavior tied to ship size.
- Keep cannon installs tied to crew cost and hull limits.
- Ensure cannon capacity progression reads clearly in upgrade choices.
Status: ✅ Starter loadout baseline updated; deeper crew-budget UX still pending.

### Pirate Fantasy Encounters (First Set)
- Village auto-raids with skiffs (build from existing skiff behavior).
- Treasure map encounter with dashed path guidance.
- Treasure chest encounter/reward moments.

### Main Loop Scope
- Hide ship designer flow from main gameplay loop.
- Keep designer content archived/dev-accessible for future use.

## Later (Post Near-Term)
- Captain unlock economy between stages.
- Stage/environment/theme unlock progression.
- Additional pirate-fantasy encounters (ghost ship, kraken, expanded raid events).
- Potential future migration of some in-run upgrade unlocks to between-run meta progression.

## Out of Scope in This Phase
- Large crew-capacity rebalance (e.g., starter near 100).
- Full timer-based upgrade cadence rewrite.
- Complex art-pipeline expansion beyond simple polygon layering style.
