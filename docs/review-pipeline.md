# Automated Review Pipeline

> Defines the two-agent loop used to verify every story implementation.
> One agent builds to spec. A separate agent grades against a hidden rubric.

---

## Overview

```
Implementing Agent                    Reviewing Agent
       |                                     |
  Reads: issue, agent-guide,           Reads: rubric (hidden from implementer),
  sprint plan, scenario YAML           review-protocol, PR diff
       |                                     |
  Writes code + unit tests             Writes scenario test scripts
  Opens PR                             Runs scripts + npm test
       |                                     |
       |                              Scores results (0–100%)
       |                                     |
       ├── score >= 85% ──────────── APPROVE → merge
       |                                     |
       ├── score < 85% ──────────── REQUEST CHANGES + feedback
       |         (iteration 1-3)             |
       ←─── fixes based on feedback ─────────┘
       |                                     |
       └── 3 iterations < 85% ────── ESCALATE → human review
```

---

## Key Principle: Separation of Knowledge

| Agent | Sees | Does NOT see |
|---|---|---|
| Implementing agent | Issue, agent-guide, sprint plan, `docs/scenarios/` | `docs/reviews/`, `docs/review-protocol.md`, rubric |
| Reviewing agent | Rubric, review-protocol, PR diff, full codebase | Nothing hidden — it has full access |

The implementing agent builds to the **technical spec**.
The reviewing agent grades against the **behavioral intent**.

This separation prevents the implementer from narrowly coding to pass a specific rubric.

---

## Rubric Format

Each story has a rubric file at `docs/reviews/story-N-rubric.yaml`.

```yaml
story: <number>
title: "<story name>"
pr: <PR number>
branch: "<feature branch>"

scenarios:
  - id: "<unique_scenario_id>"
    weight: <1-5>
    description: |
      Plain-English description of the expected behavior.
      Written from the game's perspective, not the code's perspective.
    setup: |
      How to set up the test state.
      Import which modules, create which objects, set which values.
    verify: |
      What to check after running the scenario.
      Specific observable outcomes, not implementation details.
    edge_cases:
      - "<edge case description>"
      - "<edge case description>"

scoring:
  threshold: 85
  max_iterations: 3
```

### Scoring Rules

Each scenario is scored:

| Result | Score | Meaning |
|---|---|---|
| **PASS** | 1.0 | All verify conditions met, including edge cases |
| **PARTIAL** | 0.5 | Core behavior works but edge cases fail |
| **FAIL** | 0.0 | Core behavior broken or missing |

**Final score** = sum(weight × score) / sum(weight) × 100

---

## Reviewer Agent Workflow

The reviewing agent (launched as a Codex agent task with `--custom-agent reviewer`) follows this exact sequence:

### Step 1: Read the rubric
- Read `docs/reviews/story-N-rubric.yaml` for the assigned story
- Read `docs/review-protocol.md` for report format

### Step 2: Read the PR diff
- Understand what files were changed and how

### Step 3: Run existing tests
- `npm test` — capture pass/fail
- If existing tests fail, FAIL immediately (score 0) with details

### Step 4: Write scenario test scripts
- For each scenario in the rubric, write a Node.js script in `tests/review/`
- Each script imports the actual modules, creates real state, exercises the behavior
- Scripts output structured results: `{ scenario, result: 'pass'|'partial'|'fail', details }`
- **These are NOT unit tests.** They are behavioral validation scripts that test the spirit of the scenario.

### Step 5: Run scenario scripts
- Execute each script with `node tests/review/<script>.mjs`
- Collect results

### Step 6: Score and report
- Calculate weighted score
- Post a PR review using the format from `docs/review-protocol.md` sections 5.1–5.8
- Add a score summary at the top:
  ```
  ## Scenario Score: XX%
  Threshold: 85% | Iteration: N/3

  | Scenario | Weight | Result | Details |
  |---|---|---|---|
  | ... | ... | PASS/PARTIAL/FAIL | ... |
  ```

### Step 7: Verdict
- Score >= 85%: **APPROVE**
- Score < 85%: **REQUEST CHANGES** with specific feedback per failing scenario
- Score < 85% on iteration 3: **ESCALATE** — add label `needs-human-review`, post summary

---

## Iteration Loop

When the reviewer requests changes:

1. The reviewer posts a PR review with `REQUEST CHANGES`
2. The review comment includes specific failing scenarios and what was wrong
3. A new implementing agent task is launched on the same branch to address the feedback
4. After the fix is pushed, a new reviewer agent task is launched
5. The iteration counter increments (tracked in the review comment)

If the implementing agent cannot reach 85% after 3 iterations:
- The reviewer adds the `needs-human-review` label to the PR
- Posts a summary comment: what's working, what's failing, and why it can't get there
- No merge until a human reviews

---

## File Structure

```
docs/reviews/
├── story-1-rubric.yaml    # Boss Director
├── story-2-rubric.yaml    # War Galleon
├── story-3-rubric.yaml    # Fire Ship
├── story-4-rubric.yaml    # Kraken
├── story-5-rubric.yaml    # Boss Rewards
├── story-6-rubric.yaml    # Named Stages
├── story-7-rubric.yaml    # Boss Announcement
└── story-8-rubric.yaml    # Rebalance Pass

.github/agents/
└── reviewer.md            # Custom Codex agent definition

tests/review/              # Created by reviewer agents at runtime
└── (scenario scripts written per-review)
```

---

## What Scenario Tests Are (vs. Unit Tests)

| | Unit Tests | Scenario Tests |
|---|---|---|
| **Written by** | Implementing agent | Reviewing agent |
| **Scope** | One function, one assertion | Full behavior across modules |
| **Purpose** | Does the code work as coded? | Does the code accomplish the story's goal? |
| **Style** | Vitest `it()` blocks | Standalone Node scripts that exercise real state |
| **Persist?** | Yes, in `tests/` | Yes, in `tests/review/` — reusable for regression |
| **Example** | "tickBossDirector returns a boss object" | "Simulate 10 minutes: do 3-4 bosses spawn at the right times with the right HP?" |
