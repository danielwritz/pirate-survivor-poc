# Multiplayer + Ranking Design (v0)

> This file covers **core multiplayer rules, ranking, leagues, and cosmetics**.
> For UI layout, lobby flow, HUD, and chat moderation see `notes/multiplayer_layout_and_flow.md`.

---

## Game Modes

### Single Player (Unranked)
- Endless survival: play until you die.
- Difficulty scales continuously upward over time.
- No rank / percentile changes from single-player runs.

### Multiplayer (Ranked)
- Match format: **10-minute rounds**, PvPvE.
- Servers: **authoritative official servers** (Node/Bun + WebSocket).
- Up to **10 players** per match.

---

## Round Rules

### Start Conditions
- All players spawn with an **identical starter ship** (same hull, guns, one cannon per side).
- No pre-match loadout advantage — everyone starts equal.

### In-Round Upgrades
- Gold earned from **NPC kills, island raids, and player kills** drives upgrade choices (same system as single-player).
- Snowball is intentional: early kills → more gold → faster upgrades → stronger ship.
- Ramping NPC difficulty and the respawn-far-away mechanic provide natural catch-up pressure.

### NPC Difficulty
- NPC enemy ships and island defenses spawn throughout the round.
- Difficulty **ramps over the 10 minutes** (mirrors single-player scaling).
- Late-round NPCs become a genuine threat, forcing players to split attention between PvP and PvE.

### Maps
- **Procedural** island/village layouts generated per round.
- Each match plays on a unique map.

### Death and Respawn
- On death: player **respawns at the location farthest from any active player**.
- Ship and upgrades are **kept**.
- **20% of collected doubloons are dropped** at the death location as physical loot.
- Dropped doubloons float in the world — **anyone can pick them up**.
- This creates contested hotspots and makes hunting treasure-laden ships a core strategy.

### Doubloon Sources
- NPC ship kills.
- Island village raids / building destruction.
- Player kill doubloon drops (20% of victim's stash).
- World loot / gold spawns.

---

## Player Ranking System (Simple v0)

### Inputs (per player, per ranked week)
- **K** = total kills (player kills only)
- **D** = total deaths
- **DB** = total doubloons collected

### Player Score (v0)

- **KDR = K / if(D==0, 1, D)**
- **DBNorm = DB / 10000**
- **PlayerScore = KDR * DBNorm**

Pipeline:

1. Compute **PlayerScore** for each active ranked player.
2. Convert PlayerScore into a **percentile** vs the ranked population.
3. Percentile maps to a **League Tier** (below).

### Design Notes
- Pure PvE farmers score 0 (no kills → KDR=0 → score=0). You must engage in PvP to rank.
- Pure PvP players who ignore doubloons also score low. Both dimensions matter.
- Intentionally simple for v0; future iterations may add:
  - Anti-farm kill weighting (repeat victim decay).
  - Log scaling on doubloons.
  - Minimum matches to qualify.

---

## Leagues (4 Tiers, each with I/II/III)

**Display format:**
- `[Rank Emoji + Roman Numeral] PlayerName CosmeticTitle`

Example:
- `⚓ II  Gunthera  The Swabbie`

### Tier A: Bronze (Deckhand)
- Deckhand III → Deckhand II → Deckhand I

### Tier B: Silver (Boatswain)
- Boatswain III → Boatswain II → Boatswain I

### Tier C: Gold (Quartermaster)
- Quartermaster III → Quartermaster II → Quartermaster I

### Tier D: Apex (Captain)
- Captain III → Captain II → Captain I

> Percentile cutoffs to be tuned. Goal: be generous so most players feel above Bronze.

---

## Cosmetic Titles (v0: 4 only)

Cosmetics are **titles** shown after the player name.

### Unlock rule
- A title unlocks when a player **reaches a tier** and **stays in it for a full week**.

### Equip rule
- To equip the **full "active" version** of a title, the player must **currently** be in that tier.
- If not currently in that tier, player may still equip an **inactive variant**.

### v0 title set (Active → Inactive variant)
1. **The Swabbie** → **Former Swabbie**
2. **Bilge Rat** → **Veteran Bilge Rat**
3. **Drunken Sailor** → **Once a Drunken Sailor**
4. **Landlubber** → **Reformed Landlubber**

---

## Open Questions / Future Extensions
- Percentile cutoffs for each tier and I/II/III subdivision.
- Qualification rules (min matches / min time played) to prevent tiny-sample exploits.
- Whether score is computed per-week, per-season, or rolling window.
- Kill credit rules in multi-ship engagements (last hit vs most damage).
- Anti-snowball tuning: how much early-kill advantage is healthy vs oppressive.
- Whether doubloons counted for ranking are "collected in round" vs "held at round end" (held penalizes deaths more).

