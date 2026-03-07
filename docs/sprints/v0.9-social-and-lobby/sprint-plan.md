# Sprint v0.9 — Social & Lobby (Outline)

> **Theme**: Give players a home between rounds and social features that build community.
>
> **Prerequisites**: v0.8 (ranked leagues, chat moderation) complete.

---

## Goals

1. **Lobby / Hub screen** — a pre-game area where players can see who's online, chat, and ready up for the next round.
2. **Player profiles** — show lifetime stats, personal best, league tier, rounds played.
3. **Cosmetic titles** — "Scourge of the Seas", "Kraken Slayer", etc. earned through achievements.
4. **Ship customization preview** — show the player's ship in a dock scene while waiting.
5. **AFK protection** — auto-kick players who are idle for too long in a round.

---

## Key Stories (high-level)

| # | Story | Scenarios |
|---|-------|-----------|
| 1 | Lobby screen UI + WebSocket room | new: `multiplayer/lobby.scenarios.md` |
| 2 | Ready-up system with countdown | new: `multiplayer/ready-up.scenarios.md` |
| 3 | Player profile API | new: `multiplayer/profiles.scenarios.md` |
| 4 | Cosmetic title unlocks | new: `multiplayer/titles.scenarios.md` |
| 5 | AFK detection + auto-kick | new: `multiplayer/afk-protection.scenarios.md` |
| 6 | Ship dock preview rendering | new: `rendering/dock-preview.scenarios.md` |

---

## Branch Structure

```
main
└── release/v0.9
    ├── feature/lobby-hub
    ├── feature/ready-up
    ├── feature/player-profiles
    ├── feature/cosmetic-titles
    ├── feature/afk-protection
    └── feature/dock-preview
```

---

## Definition of Done

- [ ] Players can see a lobby, ready up, and start a round together
- [ ] Profile page shows stats and league tier
- [ ] At least 5 cosmetic titles are earnable
- [ ] AFK players are kicked after configurable timeout
- [ ] All v0.7 + v0.8 regression scenarios still pass
