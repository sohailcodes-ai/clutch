# Clutch

<p align="center">
  <img src="./clutch-logo.svg" alt="Clutch" width="180">
</p>

<p align="center">
  Competitive matchmaking, ranking, and progression infrastructure.
</p>

---

## Overview

Clutch is a competitive matchmaking and progression system built around
placement matches, stack-scoped ratings, seasonal ranking, tournaments,
titles, and persistent player state.

The system is designed around a simple rule:

> Competitive state should come from actual game state.

A match is not considered resolved because a client says it was.
A ranking is not fabricated to make the leaderboard look active.
A tournament reward is not granted without a corresponding tournament
outcome.

The database remains the source of truth for persistent competitive state.

---

## Core Systems

Clutch is composed around several connected domain systems.

### Matchmaking

Handles the lifecycle of competitive matches, including:

* player discovery
* placement matching
* match creation
* match state
* match resolution
* duplicate-resolution protection

### Placement

Placement matches establish a player's initial competitive state.

The required number of placement matches is defined through the shared
`PLACEMENT_MATCHES` constant rather than duplicated as a magic number across
the codebase.

### Ratings

Competitive rating is maintained within its relevant stack.

The system tracks:

* current rating
* peak rating
* stack-specific rating state
* current win streak
* best win streak
* seasonal snapshots
* final seasonal rank

Rating state is persisted rather than reconstructed from the entire match
history for every request.

### Titles

Titles are awarded through explicit criteria.

Rating-based criteria respect their configured stack. A player's peak rating
in one stack cannot accidentally satisfy a rating requirement belonging to
another stack.

Tournament reward titles are awarded when the corresponding tournament
completes.

Duplicate reward insertion is prevented through conflict-safe persistence.

### Tournaments

Tournament state is tied to actual match resolution.

When a tournament reaches completion:

1. the champion is determined from the tournament state
2. configured rewards are processed
3. reward titles are assigned to the champion
4. duplicate reward processing is ignored

### Seasons

Season rollover creates a persistent snapshot of the previous competitive
state.

The rollover process:

1. identifies ranked players
2. orders them by rating
3. calculates their final positions
4. persists `finalRank`
5. creates the new-season state
6. resets seasonal streak state

The previous season remains represented by its snapshot rather than being
overwritten.

---

## Competitive State

The important state in Clutch is persistent and domain-driven.

For example, player streak state is stored directly:

```text
currentWinStreak
bestWinStreak
```

This avoids repeatedly scanning historical matches and performing N+1-style
queries simply to reconstruct a value that is already part of the player's
competitive state.

The same principle applies to seasonal ranking and stack-specific rating.

---

## Consistency & Invariants

Clutch treats competitive state as something that must remain internally
consistent.

### Match resolution

A match should only produce rating and progression effects when the match
itself has actually reached a valid resolution state.

### Idempotency

Operations that may be retried must not duplicate their effects.

This applies particularly to:

* match resolution
* tournament rewards
* title assignment
* persistent progression updates

### Stack isolation

A rating belonging to one competitive stack must not accidentally satisfy
criteria belonging to another stack.

### Single source of truth

Domain rules such as the number of placement matches should have one
canonical definition.

### Persistent progression

Frequently accessed progression state should be persisted instead of
reconstructed through expensive historical queries.

---

## Architecture

Clutch is organized as a monorepo containing the application, API,
background processing, and shared packages.

At a high level:

```text
                    ┌─────────────────┐
                    │    Web Client   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │       API       │
                    └───────┬─┬───────┘
                            │ │
                 ┌──────────┘ └──────────┐
                 ▼                       ▼
        ┌─────────────────┐     ┌─────────────────┐
        │   PostgreSQL    │     │      Redis      │
        └─────────────────┘     └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │     Worker      │
                                └─────────────────┘
```

The exact implementation boundaries are defined by the packages and
services in the repository.

---

## Repository Layout

```text
clutch/
├── apps/
├── packages/
├── package.json
├── ...
└── README.md
```

The repository is intentionally organized as a monorepo so domain logic,
database access, API functionality, workers, and client code can share
well-defined packages rather than duplicating implementation.

---

## Local Development

### Requirements

* Node.js
* PostgreSQL
* Redis
* npm

### Install

```bash
npm install
```

### Environment

Create the required local environment configuration from the repository's
environment example files.

Do not commit credentials, tokens, or local secrets.

### Database

Generate database artifacts:

```bash
npm run db:generate
```

Run migrations:

```bash
npm run db:migrate
```

Seed local development data:

```bash
npm run db:seed
```

Open the database studio:

```bash
npm run db:studio
```

### Development

Run the complete development environment:

```bash
npm run dev
```

Individual services can be started independently:

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
```

---

## Database

PostgreSQL is used as the persistent datastore.

Database changes are versioned through migrations rather than being applied
manually.

The schema contains the persistent state required for:

* players
* identities
* competitive stacks
* ratings
* matches
* seasons
* tournaments
* titles
* progression
* snapshots

The database is treated as the persistent source of truth for competitive
state.

---

## Recent Engineering Work

The current implementation includes several changes aimed at making the
competitive systems more correct and efficient.

### Persistent streak state

`currentWinStreak` and `bestWinStreak` are persisted on
`user_stack_ratings`.

Streaks are updated during match resolution instead of being reconstructed
through repeated historical queries.

### Stack-aware rating criteria

Rating title criteria now evaluate the peak rating belonging to the
specified stack.

This prevents a rating earned in one stack from incorrectly unlocking a
title configured for another.

### Tournament reward titles

Tournament completion automatically processes configured reward titles for
the champion.

Conflict-safe insertion prevents duplicate rewards.

### PlayerCard streak data

PlayerCard data exposes:

* `currentWinStreak`
* `bestWinStreak`

The dashboard resolves the identity stack's current streak while also
accounting for the player's best streak across stacks where required by the
view.

### Seasonal final ranks

Season rollover calculates final ranks using descending rating among
eligible ranked players and stores the resulting `finalRank` on the season
snapshot.

New-season streak state is reset during rollover.

### Placement match constant

Leaderboard logic uses the shared `PLACEMENT_MATCHES` constant instead of a
hardcoded placement count.

This keeps placement behavior consistent with the rest of the domain logic.

---

## Testing

Clutch should be tested around state transitions rather than only checking
whether individual pages render.

Important scenarios include:

```text
placement → ranked

match created → match resolved

match resolved → rating updated

match resolved → streak updated

rating updated → title criteria evaluated

tournament completed → champion determined

tournament completed → reward assigned

season rollover → finalRank persisted

season rollover → new season created

repeated resolution → no duplicate effects

repeated reward processing → no duplicate rewards
```

Edge cases should also cover:

* invalid match state transitions
* duplicate requests
* concurrent resolution attempts
* missing players
* invalid stack references
* failed database operations
* worker interruption
* Redis interruption
* browser refresh during state transitions
* API retries

---

## Engineering Principles

### Correctness over presentation

Competitive state is more important than making the UI appear active.

### Explicit domain rules

Rules should have one canonical implementation instead of being repeated
as literals throughout the codebase.

### Idempotent side effects

Anything capable of being retried should be safe to execute more than once.

### Scope correctness

Competitive data must remain associated with the correct stack, season,
player, and tournament.

### Persistence where it matters

State that represents progression should not needlessly be reconstructed
from historical data on every request.

### No fabricated competitive state

Room events, match results, rankings, titles, statistics, and tournament
outcomes should represent actual system state.

The system may influence how players interact with the game, but it should
not falsely claim that an event, result, or ranking exists when it does not.

---

## Project Status

The core placement and competitive progression implementation is complete.

The current phase is local validation and end-to-end testing of the complete
system, including the matchmaking, rating, tournament, title, streak, and
seasonal systems.

---

## Development Commands

| Command               | Purpose                           |
| --------------------- | --------------------------------- |
| `npm run dev`         | Start the development environment |
| `npm run dev:web`     | Start the web application         |
| `npm run dev:api`     | Start the API                     |
| `npm run dev:worker`  | Start the worker                  |
| `npm run build`       | Build the project                 |
| `npm run db:generate` | Generate database artifacts       |
| `npm run db:migrate`  | Apply database migrations         |
| `npm run db:seed`     | Seed development data             |
| `npm run db:studio`   | Open database tooling             |

---

## License

See the repository license for the applicable terms.
