# CLAUDE.md — Pirate Survivor POC

AI assistant guide for the **Pirate Survivor** codebase. Read this before making any changes.

---

## Project Overview

A pirate-themed naval survival game with **multiplayer as the primary direction**. It's a PvPvE battle royale: 10-minute rounds, ranked leaderboard, authoritative Node.js server. Single-player mode exists as a sandbox/development aid.

**Stack:** Vanilla JavaScript (ES modules, no bundler), Node.js 22, WebSocket (`ws`), SQLite (`better-sqlite3`), Vitest.

---

## Directory Structure

```
pirate-survivor-poc/
├── server/            # Authoritative game server (Node.js)
├── shared/            # Pure logic used by both server and client
├── src/               # Single-player–only modules
├── tests/             # Unit tests (Vitest) + story-based scenario reviews
│   └── review/        # Story acceptance tests (story-1/ through story-8/)
├── data/              # JSON data files (upgrades, ships, round options)
├── dev/               # Developer museum (visual integration tests)
├── docs/              # Design docs, GDD, agent guide, scenario specs
├── notes/             # Design thinking / scratchpad
├── scripts/           # Tooling (runtime parity check)
├── .github/workflows/ # CI: deploy.yml, story-review.yml
├── index.html         # Single-player entry point
└── mp.html            # Multiplayer entry point
```

---

## Key Source Files

### Server (`server/`)
| File | Purpose |
|------|---------|
| `index.js` | HTTP + WebSocket server, static file serving, message routing |
| `simulation.js` | **Core:** 20 Hz authoritative tick loop, phase management |
| `npcDirector.js` | NPC spawning, AI personalities, difficulty ramp |
| `bossDirector.js` | Boss scheduling, HP scaling, single-instance enforcement |
| `upgradeDirector.js` | XP/level tracking, upgrade card picker, rule application |
| `worldManager.js` | Island building HP, tower defense, gold drops |
| `leaderboardStore.js` | SQLite leaderboard with in-memory fallback |
| `chatStore.js` | SQLite chat (200-message history) with in-memory fallback |
| `fireShipBoss.js` | Fire Ship archetype: ram + ignite + self-destruct |

### Shared (`shared/`) — No DOM, No FS, Pure Logic Only
| File | Purpose |
|------|---------|
| `constants.js` | All tuning parameters (100+). Single source of truth. |
| `shipState.js` | Ship factory, derived stat calculations |
| `combat.js` | Mount-level broadside, bullets, damage, fire/ignition, repair |
| `physics.js` | Movement (rowing/sail/wind), collisions, ramming |
| `world.js` | Procedural island generation (24 seeded islands) |
| `upgradeRegistry.js` | Upgrade catalog, rule validation, rule application |
| `roundConfig.js` | Round voting categories, vote resolution |
| `stages.js` | Named stage definitions (Calm, Tempest, Maelstrom) |

### Single-Player (`src/`)
Used only by `index.html`. Contains `core/` (math, physics, state, player) and `systems/` (audio, particles, upgrade rule engine) and `rendering/` (ship renderer). Not used by the multiplayer server.

---

## Development Workflows

### Running Locally

```bash
# Install deps (first time only)
npm install

# Verify Node version (required — better-sqlite3 is ABI-sensitive)
npm run check:runtime

# Start multiplayer server
npm start
# Open http://localhost:3000

# Single-player sandbox (no server needed)
npx serve . -l 4173
# Open http://localhost:4173/index.html

# Developer museum (visual integration tests)
# Open http://localhost:4173/dev/index.html
```

### Running Tests

```bash
npm test           # vitest run (all unit tests, one-shot)
npm run test:watch # vitest watch mode
```

### Environment Variables (Multiplayer Server)
- `PORT` — HTTP port (default: `3000`)
- `LEADERBOARD_DB_PATH` — SQLite path (default: `data/leaderboard.sqlite`)
- `CHAT_DB_PATH` — SQLite path (default: `data/chat.sqlite`)

---

## Testing Architecture

### Unit Tests (`tests/*.test.js`)
17 Vitest unit test files covering all shared modules and server directors. Always run after any logic change.

### Story Review Tests (`tests/review/story-N/`)
Rubric-based acceptance tests for each major feature story. These run as Node ES modules (`.mjs`), not via Vitest. The CI gate (`story-review.yml`) runs them on PRs and posts a rubric table. Verdict: ≥85% passes = APPROVE.

Story mapping:
| Story | Feature |
|-------|---------|
| 1 | Boss Director pattern |
| 2 | War Galleon boss |
| 3 | Fire Ship boss |
| 4 | Kraken boss |
| 5 | Boss rewards |
| 6 | Named stages |
| 7 | Boss announcement |
| 8 | Rebalance (constants-only) |

---

## Architecture Principles

1. **Shared = pure logic.** Files in `shared/` must have zero DOM, canvas, or Node `fs` imports. They run on both the server and in the browser.

2. **Constants are the single source of truth.** All numeric tuning lives in `shared/constants.js`. Never hardcode magic numbers in directors or combat logic — reference the constant.

3. **Authoritative server.** The server runs a deterministic 20 Hz tick loop. Clients send inputs; the server owns all state. Never trust client-reported positions or stats.

4. **Data-driven upgrades.** Upgrades are defined in `data/upgrades.json` as operation-based rule lists (`set`, `add`, `mul`, `clamp`, `call`, etc.). Implement new upgrades by adding JSON entries, not new code paths.

5. **One boss at a time.** `bossDirector.js` enforces single-instance boss presence. Do not add boss-spawning logic elsewhere.

6. **Directors are injected, not imported.** Server directors (`npcDirector`, `bossDirector`, etc.) receive simulation state via function arguments. They do not hold global state themselves.

7. **No bundler.** There is no Webpack, Vite, or Rollup. HTML files use `<script type="module">` with bare imports served by the Node HTTP server. Do not introduce a build step without explicit discussion.

8. **Node 22 is locked.** `better-sqlite3` is an ABI-sensitive native module. Do not change the Node major version without updating `.nvmrc`, Azure runtime config, and the `check:runtime` script together.

---

## Conventions

### Code Style
- ESM (`import`/`export`) everywhere — no CommonJS `require()`.
- No TypeScript — plain JavaScript with JSDoc comments where types matter.
- Prefer named exports over default exports.
- Factory functions over classes (e.g., `createSimulation()`, `createShipState()`).

### Game State
- All mutable game state lives inside the simulation tick. Avoid module-level mutable variables.
- Ship state objects follow the shape defined in `shared/shipState.js`.
- NPC ships and player ships share the same state shape.

### Adding New Features
1. **Logic first:** Add to `shared/` if reusable by both client and server. Add to `server/` only if server-specific.
2. **Wire into simulation:** New systems get called from `server/simulation.js` inside the tick loop.
3. **Expose via constants:** Any tunable value goes into `shared/constants.js`.
4. **Write a unit test** in `tests/` before or immediately after implementing.
5. **Update `docs/current-state.md`** to reflect new implemented systems.

### Adding New Upgrades
1. Add an entry to `data/upgrades.json` following the existing schema.
2. Validate with the upgrade catalog test (`tests/upgradesCatalog.test.js`).
3. Do not add new operation types without updating `shared/upgradeRegistry.js` and its tests.

### Adding New Boss Types
1. Create `server/<name>Boss.js` following the pattern of `fireShipBoss.js`.
2. Register in `server/bossDirector.js`.
3. Add archetype constant to `shared/constants.js`.
4. Add story scenario tests under `tests/review/story-N/`.

---

## WebSocket Message Protocol

### Client → Server
| Message | Payload |
|---------|---------|
| `playerInput` | `{ steering, rowing, braking, sailToggle }` |
| `playerFireCannon` | `{ targetX, targetY }` |
| `playerSelectUpgrade` | `{ choice: 1|2|3 }` |
| `submitRoundVote` | `{ category, value }` |
| `chatMessage` | `{ text }` |

### Server → Client (Broadcast)
| Message | Payload |
|---------|---------|
| `gameState` | Full or delta state snapshot (20 Hz) |
| `roundEnd` | Final scores, leaderboard positions |
| `playerDeath` | `{ playerId, killedBy }` |
| `bossSpawn` | `{ bossType, x, y, hp }` |
| `chatHistory` | Array of recent messages |
| `leaderboardUpdate` | Current global rankings |

---

## CI/CD

### `deploy.yml` (push to `main`)
1. Verify Node version parity (`npm run check:runtime`)
2. Assert no `node_modules` in artifact
3. Deploy to Azure App Service (Node 22 Linux)

### `story-review.yml` (PRs to feature branches)
1. **baseline:** `npm test` must pass
2. **review:** Determine story number from base branch name, run `tests/review/story-N/*.mjs`, post rubric comment, approve/request-changes at 85% threshold

**Do not bypass CI.** Fix failing tests before pushing to `master`.

---

## Docs to Read for Context

| Doc | When to read |
|-----|-------------|
| `DESIGN.md` | Understand POC goals and engineering architecture |
| `ROADMAP.md` | Understand what's planned vs. implemented |
| `docs/gdd.md` | Game design intent before changing gameplay feel |
| `docs/current-state.md` | Inventory of all systems and their status |
| `docs/agent-guide.md` | Additional AI-specific implementation guidance |
| `docs/review-protocol.md` | How PR reviews and rubrics work |
| `notes/multiplayerthoughts.md` | Rules, ranking, economy design rationale |
