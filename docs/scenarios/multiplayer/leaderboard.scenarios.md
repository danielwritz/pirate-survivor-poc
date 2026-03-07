# Leaderboard Scenarios

> Score persistence, ranking, personal bests, and leaderboard queries.

---

### Scenario: Round score is persisted to SQLite

At round end, each player's score (doubloons) should be stored in the leaderboard SQLite database with their player name and timestamp.

**Given** player "BlackBeard" finishes a round with 520 doubloons
**When** the round ends and scores are persisted
**Then** a new row should exist in the leaderboard table for "BlackBeard" with score 520

```yaml
id: score_persisted_to_sqlite
tags: [multiplayer, leaderboard]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  player: { name: BlackBeard, doubloons: 520 }

actions:
  - endRound: {}
  - persistScores: {}

assertions:
  - leaderboard.lastEntry: { player: BlackBeard, score: 520 }
```

---

### Scenario: Top 10 scores retrievable

The leaderboard should support querying the top N scores, defaulting to top 10, sorted descending by score.

**Given** 25 scores have been recorded
**When** the top 10 leaderboard is queried
**Then** exactly 10 entries should be returned
**And** they should be sorted highest-to-lowest

```yaml
id: top_10_query
tags: [multiplayer, leaderboard]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  leaderboard: { totalEntries: 25 }

actions:
  - queryTopScores: { limit: 10 }

assertions:
  - results.length: 10
  - results[0].score: ">= results[1].score"
```

---

### Scenario: Recent scores retrievable

The leaderboard should support querying the most recent N scores, useful for showing "recent games" on the results screen.

**Given** 50 rounds have been played
**When** the 5 most recent scores are queried
**Then** 5 entries should be returned
**And** they should be ordered by most recent first

```yaml
id: recent_scores_query
tags: [multiplayer, leaderboard]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  leaderboard: { totalEntries: 50 }

actions:
  - queryRecentScores: { limit: 5 }

assertions:
  - results.length: 5
  - results[0].timestamp: ">= results[1].timestamp"
```

---

### Scenario: Personal best is tracked

Each player's highest ever score should be derivable from the leaderboard data so it can be displayed on the results screen.

**Given** "BlackBeard" has played 5 rounds with scores [120, 520, 340, 210, 450]
**When** personal best is queried for "BlackBeard"
**Then** the result should be 520

```yaml
id: personal_best_tracked
tags: [multiplayer, leaderboard]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  leaderboard: { player: BlackBeard, scores: [120, 520, 340, 210, 450] }

actions:
  - queryPersonalBest: { player: BlackBeard }

assertions:
  - personalBest: 520
```

---

### Scenario: Leaderboard survives server restart

The SQLite database should persist on disk so that leaderboard data is not lost when the server process restarts.

**Given** scores have been recorded and the server restarts
**When** the leaderboard is queried after restart
**Then** all previously recorded scores should still be present

```yaml
id: leaderboard_persistence_across_restarts
tags: [multiplayer, leaderboard]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  leaderboard: { preexistingEntries: 10 }

actions:
  - restartServer: {}
  - queryTopScores: { limit: 10 }

assertions:
  - results.length: 10
```

---

### Scenario: All round participants get leaderboard entries

Every player who was in the round at the end (alive or dead) should get a leaderboard entry. Disconnected players who left early should not.

**Given** 6 players in a round: 4 alive, 1 dead/spectating, 1 disconnected mid-round
**When** the round ends
**Then** 5 leaderboard entries should be created (excluding the disconnected player)

```yaml
id: all_participants_scored
tags: [multiplayer, leaderboard, scoring]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  players:
    - { id: A, alive: true }
    - { id: B, alive: true }
    - { id: C, alive: true }
    - { id: D, alive: true }
    - { id: E, alive: false, spectating: true }
    - { id: F, disconnected: true }

actions:
  - endRound: {}

assertions:
  - leaderboardEntries: 5
```
