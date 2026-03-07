# Sprint v0.8 — PvP & Ranked Leagues (Outline)

> **Agent start point**: Read [`docs/agent-guide.md`](../../agent-guide.md) first, then return here.

> **Theme**: Make player-vs-player combat rewarding and introduce competitive progression across rounds.
>
> **Prerequisites**: v0.7 (boss system, named stages) complete.

---

## Goals

1. **Ranked scoring formula** — ELO-like system that accounts for kills, survival, doubloons, and boss participation.
2. **League tiers** — Dinghy, Sloop, Brigantine, Galleon, Man-o-War (as designed in multiplayerthoughts.md).
3. **PvP rebalance** — tune death penalties, respawn invuln, and doubloon theft to make PvP engagements feel decisive but not griefing.
4. **Chat moderation** — message length cap, rate limiting, basic profanity filter.
5. **Kill feed & PvP announcements** — broadcast kills and bounties to all players.

---

## Key Stories (high-level)

| # | Story | Scenarios |
|---|-------|-----------|
| 1 | Ranked scoring formula | new: `scoring/ranked-formula.scenarios.md` |
| 2 | League tier thresholds & promotion | new: `scoring/leagues.scenarios.md` |
| 3 | PvP bounty system (high-score player = high bounty) | `pvp/player-combat.scenarios.md` (extend) |
| 4 | Kill feed broadcast | new: `multiplayer/kill-feed.scenarios.md` |
| 5 | Chat message length cap | `multiplayer/chat.scenarios.md` — message_length_capped |
| 6 | Chat rate limiting | `multiplayer/chat.scenarios.md` — chat_rate_limiting |
| 7 | Basic profanity filter | `multiplayer/chat.scenarios.md` — profanity_filter |
| 8 | PvP death penalty tuning | `pvp/death-respawn.scenarios.md` (verify balance) |

---

## Branch Structure

```
main
└── release/v0.8
    ├── feature/ranked-scoring
    ├── feature/league-tiers
    ├── feature/pvp-bounty
    ├── feature/kill-feed
    ├── feature/chat-moderation
    └── feature/pvp-rebalance
```

---

## Definition of Done

- [ ] Ranked score calculated and persisted alongside raw doubloon score
- [ ] League tier displayed on results screen
- [ ] Chat moderation scenarios pass
- [ ] PvP feels competitive but not toxic (playtest)
- [ ] All v0.7 regression scenarios still pass
- [ ] All PRs reviewed per [docs/review-protocol.md](../../review-protocol.md)
