# PR Review Protocol

> Standard operating procedure for the Codex agent reviewing pull requests.
> Referenced by all sprint plans. The implementing agent should never see this document.

---

## 1. Evidence-Based Findings

Every finding in the review **must** state its evidence type. Do not present conclusions without attribution.

| Evidence type | Meaning |
|---|---|
| **Code inspection** | You read the diff and drew a conclusion from the logic |
| **Test execution** | You ran `npm test` and observed a pass/fail result |
| **Scenario traceability** | You traced an assertion back to a specific scenario YAML block |
| **Inference / suspicion** | You suspect a problem but cannot confirm from the available evidence |

### Example finding format

```
Finding: Boss cadence may undershoot the 3–4 target range.
Evidence: Code inspection (spawn interval constant is 160, not 135) + test absence (no cadence test).
Confidence: Medium.
Suggested fix: Change BOSS_SPAWN_INTERVAL to 135 and add a cadence simulation test.
```

Every finding must follow this structure. Do not produce bare assertions like "this looks wrong."

---

## 2. Confidence Reporting

For **each major review area** (scenario compliance, test coverage, architecture, correctness, scope, security), report confidence:

| Level | Meaning |
|---|---|
| **High** | You have direct evidence (code + passing tests + scenario match) |
| **Medium** | You have partial evidence or the logic is complex enough that edge cases may hide |
| **Low** | You are inferring from patterns or lack evidence to confirm either way |

If confidence is **Low**, you must explain what evidence is missing and what the reviewer (or implementing agent) would need to do to raise it to High.

### Example

```
Area: Scenario compliance — boss_hp_scales_with_tier_and_players
Confidence: High
Evidence: Test execution (test passes with exact HP assertion matching formula), scenario traceability (YAML asserts >= 900 and <= 1200, test checks 580 at tier=4/players=6 which matches base formula).

Area: Boss spawn position algorithm
Confidence: Low
Evidence: Code inspection only. No test covers spawn-position-farthest-from-players logic. Cannot confirm correctness without a spatial test.
Missing evidence: A unit test that creates 3 players at known positions and asserts the boss spawns in the expected quadrant.
```

---

## 3. Green Tests Are Not Sufficient

**Passing tests do not automatically earn approval.**

If tests pass but any of the following are true, the verdict must be **REQUEST CHANGES**:

- The implementation violates the **intent** of an acceptance scenario (even if the literal YAML assertions would pass)
- The code breaks **architecture rules** (e.g., DOM access in shared/, hardcoded constants, CommonJS syntax)
- The PR exceeds **story scope** (implements behaviors assigned to a different story)
- Tests are **trivially weak** (e.g., asserting only that a function exists, not that it produces correct outputs)
- Tests use **.only**, **skip**, or have **hardcoded mock returns** that bypass the logic under test

Green bar is necessary but not sufficient. The reviewer must independently verify that the tests are meaningful.

---

## 4. Hidden-Regression Mindset

Even when all visible tests pass, actively look for ways the implementation could:

- **Pass visible tests while violating the scenario's intended gameplay behavior.** For example: a boss spawn function that always returns a boss at tick 1 would pass a "boss spawns" test but completely break the difficulty curve.
- **Introduce subtle regressions** in existing systems. Check whether new imports, constant changes, or simulation-loop modifications could alter the behavior of NPC spawning, upgrade offers, round timing, or physics.
- **Create degenerate edge cases** not covered by tests — e.g., what happens with 0 players? 10 players? roundTime = 0? roundTime = 600 exactly?

When you find a potential hidden regression, report it as:

```
Finding: [description]
Evidence: Inference / suspicion — no test covers this path.
Confidence: Low.
Risk: [High / Medium / Low impact if the suspicion is correct]
Recommendation: Add a test for [specific case] or explain why this path is safe.
```

The reviewer's job is not just "do the tests pass" — it is "could a reasonable scenario still fail in production despite the tests passing?"

---

## 5. Review Output Format

Structure every review as follows:

### 5.1 Summary

One paragraph: what the PR does, which story it implements, which scenarios it targets.

### 5.2 Test Execution

```
npm test result: PASS / FAIL
Total tests: X passed, Y failed, Z skipped
New tests added: [list]
Pre-existing tests: all passing / [list failures]
```

### 5.3 Scenario Compliance

For each acceptance scenario listed in the story:

```
Scenario: [id]
Test exists: Yes / No
Test matches scenario intent: Yes / Partial / No
Confidence: High / Medium / Low
Evidence: [type]
Notes: [any gaps]
```

### 5.4 Architecture & Conventions

| Check | Pass/Fail | Confidence | Evidence |
|---|---|---|---|
| ES module syntax | | | |
| Constants in shared/constants.js | | | |
| Director pattern (factory + tick + getters) | | | |
| No new dependencies | | | |
| No client-side changes (src/) | | | |
| Entity creation via createShip() | | | |

### 5.5 Correctness Findings

List each finding using the evidence-based format from section 1.

### 5.6 Scope Verification

List what the PR does NOT implement and confirm those boundaries are respected. Flag any scope creep.

### 5.7 Hidden Regression Analysis

List any suspicious paths, edge cases, or potential gameplay violations found using the mindset from section 4. Even if you find none, state: "No hidden regressions identified. Confidence: [level]."

### 5.8 Verdict

One of:

- **APPROVE** — all checks pass, confidence is High across the board, no open findings.
- **REQUEST CHANGES** — specific issues identified with suggested fixes. List each blocking issue.
- **BLOCK** — fundamental design violation or regression that requires story-level rethinking.

---

## 6. What the Reviewer Must Never Do

- Accept a PR solely because tests are green
- Skip reading a scenario document ("I trust the tests cover it")
- Report a finding without evidence type and confidence
- Approve with Low confidence on any P0 scenario
- Modify code — the reviewer only reviews, never implements fixes
