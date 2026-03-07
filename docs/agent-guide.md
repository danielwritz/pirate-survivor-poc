# Agent Guide

> **Start here.** This is the single entry point for any Codex agent working on this codebase.
> Read this document first, then follow the track that matches your role.

---

## Quick Orientation

This is **Pirate Survivor** — a pirate naval roguelike with 10-minute ranked PvPvE multiplayer rounds. Server is authoritative, 20 Hz tick rate, ships are flat JSON objects, pure-logic modules in `shared/` run on both server and client.

### Read order (everyone reads these)

| Order | Document | Why |
|-------|----------|-----|
| 1 | **This file** (`docs/agent-guide.md`) | Entry point, architecture, workflow |
| 2 | `docs/current-state.md` | What's built, what's tested, what's missing |
| 3 | `docs/gdd.md` | Full game design — the "why" behind every system |
| 4 | `docs/scenario-format.md` | How to read scenario files |

### Key code files (skim before writing anything)

| File | Role |
|------|------|
| `shared/constants.js` | Single source of truth for all tuning values |
| `shared/shipState.js` | Ship factory (`createShip`), derived stats |
| `shared/combat.js` | Weapons, bullets, damage, fire, repair |
| `shared/physics.js` | Movement, wind, collisions |
| `server/simulation.js` | Main tick loop — where everything is orchestrated |
| `server/npcDirector.js` | Reference pattern for how directors work |
| `server/upgradeDirector.js` | XP, levels, upgrade offers |
| `server/worldManager.js` | Islands, buildings, towers |
| `tests/npcDirector.test.js` | Reference pattern for how tests are written |

---

## Architecture Rules (non-negotiable)

1. **ES modules only** — `import`/`export`, never `require()`
2. **`shared/` is pure** — no DOM, no `fs`, no Node-only APIs. Must run on server AND client.
3. **`server/` is authoritative** — all game state mutations happen here
4. **`src/` is client-only** — rendering, input, single-player. Multiplayer agents rarely touch this.
5. **Constants live in `shared/constants.js`** — never hardcode tuning values in logic files
6. **Ships are JSON** — every ship is a flat object created by `createShip()`. No classes.
7. **Directors follow a pattern**: factory function (`createXxxDirector`) + tick function (`tickXxxDirector`) + query helpers (`getXxx`). See `server/npcDirector.js`.
8. **No new npm dependencies** without explicit approval

---

## Three Roles, Three Tracks

### Track A: Implementing a Story

You are writing new code to make acceptance scenarios pass.

#### Step-by-step

1. **Read your story** in the sprint plan (e.g., `docs/sprints/v0.7-pve-power-fantasy/sprint-plan.md`, Story 1).
2. **Read every linked acceptance scenario** — open the scenario file, find each scenario by ID, read both the narrative header AND the YAML execution block.
3. **Read the reference code** — the sprint plan lists implementation notes with specific files. Read those files. Understand the patterns before writing new code.
4. **Add constants first** — if your story needs new tuning values, add them to `shared/constants.js` with a section comment.
5. **Write the implementation** — follow the director pattern. Export a factory, a tick function, and query helpers. Keep pure logic in `shared/`, server orchestration in `server/`.
6. **Integrate into simulation.js** — import your director, create it in `createSimulation()`, call it in the tick loop. Keep the integration minimal (import, create, tick, broadcast).
7. **Write tests** — see Track B below.
8. **Run `npm test`** — all tests (old and new) must pass. Do not commit with failures.
9. **Scope check** — re-read your story's scope constraints. If it says "do NOT implement X," verify you didn't. Scope creep is a review failure.

#### What you receive

- The sprint plan story (summary, acceptance scenario IDs, implementation notes, scope constraints)
- Access to all `docs/` files
- Access to the full codebase

#### What you produce

- New/modified source files
- New test file(s)
- A commit message following: `feat(story-name): <what was done>`

---

### Track B: Writing Tests for a Story

Tests may be written by the implementing agent (Track A) or by a separate testing agent. Either way, follow this process.

#### Step-by-step

1. **Read the acceptance scenarios** for your story. Each scenario has a YAML execution block with `id`, `setup`, `actions`, and `assertions`.
2. **Map each scenario to a test.** One scenario = at least one `it()` block. The test ID should match the scenario ID:
   ```js
   it('boss_first_spawn_at_tier_2', () => { ... });
   ```
3. **Follow the existing test style** — look at `tests/npcDirector.test.js` and `tests/combat.test.js`. Pattern:
   - Import the module functions directly (no HTTP, no WebSocket)
   - Create minimal state using factories (`createShip`, `createBossDirector`, etc.)
   - Call the function under test
   - Assert outputs with Vitest `expect()`
4. **Test the scenario intent, not just the YAML literals.** The YAML is a guide. If the scenario says "boss HP scales with tier and players" and the YAML asserts `>= 900`, your test should verify the *formula* produces the right number for specific inputs, not just that some number is >= 900.
5. **Cover edge cases** that the scenarios imply but don't spell out:
   - Zero players
   - Maximum players (10)
   - Round time exactly at boundary (0, 150, 600)
   - Multiple rapid calls in the same tick
6. **Never use `.only` or `.skip`** — every test runs every time.
7. **Never mock the module under test** — mock external dependencies if needed, but the code being tested must be real.
8. **Run `npm test`** — verify all tests pass, including pre-existing ones.

#### What you produce

- `tests/<feature>.test.js` — one file per story/director
- All tests passing with `npm test`

---

### Track C: Reviewing a PR

You are reviewing code written by an implementing agent.

#### Step-by-step

1. **Read `docs/review-protocol.md`** — this is your operating procedure. Follow it exactly.
2. **Read the story** from the sprint plan — understand what was requested and what was explicitly out of scope.
3. **Read every acceptance scenario** linked in the story.
4. **Read the diff** — understand what changed.
5. **Run `npm test`** — verify all tests pass.
6. **Produce a structured review** following the output format in `docs/review-protocol.md` sections 5.1–5.8.

#### Key principles (from review-protocol.md)

- Every finding needs an **evidence type** (code inspection / test execution / scenario traceability / inference)
- Every review area needs a **confidence level** (High / Medium / Low)
- **Green tests are not sufficient** — tests can pass while the implementation violates scenario intent
- **Hidden-regression mindset** — actively look for ways the code could pass tests but break gameplay

#### What you produce

- A structured review document ending in a verdict: APPROVE / REQUEST CHANGES / BLOCK

---

## File Map for Common Tasks

| I need to... | Read | Write |
|---|---|---|
| Add a new director | `server/npcDirector.js` (pattern) | `server/myDirector.js` |
| Add constants | `shared/constants.js` | `shared/constants.js` |
| Create an entity | `shared/shipState.js` → `createShip()` | — |
| Integrate into tick loop | `server/simulation.js` | `server/simulation.js` |
| Write tests | `tests/npcDirector.test.js` (pattern) | `tests/myFeature.test.js` |
| Understand upgrade system | `server/upgradeDirector.js` + `shared/upgradeRegistry.js` | — |
| Understand combat | `shared/combat.js` + `shared/constants.js` (combat section) | — |
| Understand islands/towers | `server/worldManager.js` + `shared/world.js` | — |
| Check what's already built | `docs/current-state.md` | — |
| Check game design intent | `docs/gdd.md` | — |
| Find acceptance scenarios | `docs/sprints/<version>/sprint-plan.md` → scenario links | — |
| Read scenario format | `docs/scenario-format.md` | — |

---

## Prompt Templates

### Minimal implementing agent prompt

```
Read docs/agent-guide.md first, then follow Track A.

Your assignment: Story N from docs/sprints/vX.Y-<name>/sprint-plan.md.
Branch: feature/<story-name> from release/vX.Y.

Implement the story, write tests, and run npm test before committing.
```

### Minimal reviewing agent prompt (manual — Track C)

```
Read docs/agent-guide.md first, then follow Track C.

You are reviewing the PR from feature/<story-name> into release/vX.Y.
Follow docs/review-protocol.md exactly. Produce a structured review with verdict.
```

### Automated reviewer agent prompt (preferred)

```
You are reviewing PR #N for Story N.
Read docs/reviews/story-N-rubric.yaml for your grading rubric.
Read docs/review-protocol.md for report format.
Read docs/review-pipeline.md for the full pipeline design.

Follow the reviewer workflow exactly: run npm test, write scenario test scripts
in tests/review/story-N/, run them, score results, post a structured review.
Threshold: 85%. This is iteration M/3.
```

Launch with: `gh agent-task create -F - --base "<pr-branch>" --custom-agent reviewer`

See `docs/review-pipeline.md` for the full two-agent loop design.

---

## Keeping Docs Current

| Document | Updated by | When |
|---|---|---|
| Scenario status (`pending` → `passing`) | Implementing agent (Track A) | Same commit as the implementation |
| `docs/current-state.md` | Implementing agent (Track A) | Same commit — add new systems/files |
| Sprint plan stories (mark done) | Implementing agent (Track A) | Same commit |
| `docs/agent-guide.md` file map | Implementing agent (Track A) | Only if a new pattern was introduced |
| `docs/gdd.md` | **Human only** | Design decisions |
| `docs/review-protocol.md` | **Human only** | Process gaps |
| `docs/scenario-format.md` | **Human only** | Format changes |
| `docs/review-pipeline.md` | **Human only** | Pipeline design changes |
| `docs/reviews/*.yaml` rubrics | **Human only** | New stories or rubric updates |
| Next sprint plan (detail it) | **Human only** | When previous sprint completes |

**Rule**: Implementing agents update docs that reflect *what's built*. Humans update docs that reflect *what should be built*.

That's it — the docs do the rest.
