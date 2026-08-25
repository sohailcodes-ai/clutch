<p align="center">
  <img src="..." alt="Clutch" />
</p>

<p align="center">
  Competitive matchmaking, ranking, and progression infrastructure.
</p>

<p align="center">
  <a href="..."><img ... /></a>
  <a href="..."><img ... /></a>
  <a href="..."><img ... /></a>
</p>

---

## Clutch

Clutch is a competitive matchmaking and progression system built around
placement matches, stack-scoped ratings, seasonal ranking, tournaments,
titles, and persistent player state.

It is designed around one principle:

> competitive state should be derived from actual game state.

---

## Architecture

```text
                         ┌──────────────┐
                         │    Web App   │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │   API Layer  │
                         └──────┬───────┘
                                │
                 ┌──────────────┼──────────────┐
                 ▼              ▼              ▼
            PostgreSQL       Redis          Worker
                 │              │              │
                 └──────────────┴──────────────┘
                                │
                                ▼
                     Match / Rating Engine
