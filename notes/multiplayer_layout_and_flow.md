# Multiplayer Layout & Flow (v1)

> This file covers **UI screens, lobby flow, HUD, chat moderation, and post-game flow**.
> For core game rules, ranking, leagues, and cosmetics see `notes/multiplayerthoughts.md`.

---

## 1. Title Screen

### Layout
- Full-screen background art.
- Centered vertical menu:
  - Play
  - Settings
  - Exit

Selecting **Play** transitions to the Main Hub screen.

---

## 2. Main Hub (Post-Title Screen)

This is the primary navigation screen.

### Layout Structure

Left Column:
- Quick Join (Ranked Multiplayer)
- Server Browser (Official Servers)
- Single Player (Unranked)

Right Column:
- Profile
- Friends List
- Ignore List

Bottom Panel:
- Global Chat Room
  - Scrollable chat feed
  - Input field
  - Shows player rank indicator + name

Example chat line:
`⚓ II Gunthera: Ready to plunder.`

### Notes
- This chat room persists while on this screen.
- Simplified first pass: friends/ignore lists may be placeholders.

---

## 3. Single Player (Unranked)

### Flow
- Start Run → immediate spawn.
- Endless survival, difficulty scales upward.
- Play until death.
- Post-run screen shows stats only.
- Return to Main Hub.

---

## 4. Multiplayer Lobby (Ranked)

### Entry
- Via Quick Join or Server Browser.

### Lobby Behavior
- Players spawn immediately in separate corners of a **procedurally generated map**.
- Shooting disabled.
- No NPC spawns.
- Lobby chat enabled.
- Players may sail freely.

### Start Conditions
- If 10 players join → short countdown → round begins.
- If no new joins for 30 seconds → round begins.

---

## 5. Ranked Round Flow

> Full round rules (upgrades, NPCs, death/respawn, doubloon mechanics) are in `multiplayerthoughts.md`.

- Duration: **10 minutes**.
- PvPvE: NPC enemies + island defenses ramp in difficulty over the match.
- On death: respawn farthest from active players, keep ship/upgrades, drop 20% doubloons as world loot.

---

## 6. AFK Protection

- If no input detected for **2 minutes**: player is automatically removed from lobby.
- No shooting, movement, or key input counts as inactivity.

---

## 7. Chat Auto-Moderation (LLM-assisted)

### Goal
Automatically silence (timeout) chat messages containing:
- hate speech / slurs
- targeted harassment
- bigotry / extremist praise
- sexual content / grooming
- threats / incitement

Players can continue playing while silenced.

### Flow
1. Message is received by server.
2. Server sends message (plus minimal context) to a moderation agent.
3. Agent returns: **allow** | **block**.
4. If **allow** → broadcast to lobby chat.
5. If **block** → suppress message, player receives a timeout.

### Timeout Escalation
- Start timeout: **30 seconds**.
- Each violation doubles: 30s → 60s → 120s → 240s → 480s …
- Reset: after **10 minutes** clean, drop one escalation level. Continues dropping every 10 clean minutes until base.

### Implementation Notes (v1)
- Moderation request payload: message text, player id, lobby id, optional last 1–3 messages for context.
- Log events: timestamp, player id, message hash, decision, timeout applied.
- Fallback if moderation service unavailable: **allow + rate-limit**.

---

## 8. In-Match HUD

Top Center:
- Match timer (10:00 countdown)

Bottom HUD:
- Ship health
- Doubloons collected (current held amount)
- K / D tracker

Tab Overlay (press Tab):

`[Rank Indicator] PlayerName [Cosmetic Indicator] | K | D | Doubloons`

Example:
`⚓ II Gunthera 🧽 | 7 | 3 | 1540`

---

## 9. End-of-Round Results Screen

Duration: 60–90 seconds.

### Top Three Panels

Shows leaders in:
- Most Kills
- Best K/D Ratio
- Most Doubloons Collected

Each panel shows:
- Rank indicator + player name + cosmetic indicator + stat value

Example:
`👑 Gunthera – Most Doubloons (8420)`

---

## 10. Post-Game Lobby Flow

After results screen:

- Prompt: **"Stay in Lobby?"** → Yes / No
- **Yes**: player remains. If enough players stay → countdown → new round on fresh procedural map.
- **No** (or no response): exit to Main Hub.
- AFK players removed automatically.

---

This document covers the UI and flow layer of multiplayer. Game rules and ranking live in `notes/multiplayerthoughts.md`.

