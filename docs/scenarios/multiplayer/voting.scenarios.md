# Voting Scenarios

> Post-round voting for next round options (map, mutators, duration).

---

### Scenario: Three round options are presented after a round

At round end, the server should present exactly 3 randomly generated round options for the next round, each with a distinct flavor.

**Given** a round has just ended
**When** the results screen is shown
**Then** 3 vote options should be presented to all clients
**And** each option should have a name, duration, and list of mutators

```yaml
id: three_vote_options
tags: [multiplayer, voting]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  round: { ended: true }

actions:
  - generateVoteOptions: {}

assertions:
  - voteOptions.length: 3
  - voteOptions[0].name: { not: null }
  - voteOptions[0].duration: ">= 300"
```

---

### Scenario: Players can cast one vote each

Each player gets exactly one vote. Changing your vote replaces the previous one.

**Given** 3 vote options are active
**When** player A votes for option 2
**And** player A then votes for option 1
**Then** player A's vote should count for option 1 only

```yaml
id: one_vote_per_player
tags: [multiplayer, voting]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  voteOptions: [opt0, opt1, opt2]
  playerA: { vote: null }

actions:
  - castVote: { player: A, option: 2 }
  - castVote: { player: A, option: 1 }

assertions:
  - votes.option0: 0
  - votes.option1: 1
  - votes.option2: 0
```

---

### Scenario: Winning option starts the next round

The option with the most votes should be selected for the next round. Ties should be broken randomly.

**Given** voting has concluded with option 1 receiving 4 votes and option 2 receiving 2 votes
**When** the vote timer expires
**Then** round options from option 1 should be applied to the next round

```yaml
id: winning_option_starts_round
tags: [multiplayer, voting]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  votes: { option0: 1, option1: 4, option2: 2 }

actions:
  - resolveVote: {}

assertions:
  - selectedOption: 1
```

---

### Scenario: Vote options are generated from multiplayer-round-options.json

The round option generator should pull mutator pools and duration ranges from the data/multiplayer-round-options.json config file.

**Given** the round options config file exists
**When** 3 options are generated
**Then** each option's mutators should be drawn from the configured mutator pool
**And** durations should be within the configured range

```yaml
id: options_from_config
tags: [multiplayer, voting]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  configFile: data/multiplayer-round-options.json

actions:
  - generateVoteOptions: {}

assertions:
  - allMutatorsValid: true
  - allDurationsInRange: true
```

---

### Scenario: Vote countdown timer visible to players

Players should see how much time remains to vote, creating urgency and preventing indefinite waits.

**Given** voting has started with a 20-second countdown
**When** 10 seconds pass
**Then** the remaining time broadcast should show approximately 10 seconds

```yaml
id: vote_countdown_timer
tags: [multiplayer, voting]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  voteTimer: 20

actions:
  - advanceTime: 10

assertions:
  - voteTimeRemaining: { approx: 10, tolerance: 1 }
```
