# Clutch

<p align="center">
  <img src="./clutch-logo.svg" alt="Clutch" width="180">
</p>

<p align="center">
  <strong>Competitive matchmaking. Persistent progression. Pressure with consequences.</strong>
</p>

<p align="center">
  A competitive system built around placement, rating, momentum, tournaments,
  seasons, and the decisions players make under pressure.
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#systems">Systems</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#development">Development</a>
</p>

---

## Overview

Clutch is a competitive matchmaking and progression platform.

It takes the usual loop—

```text
queue → match → win / lose → rating
```

—and gives it persistence.

Players enter through placement, build a competitive record, accumulate
momentum, compete across stacks, enter tournaments, earn titles, and carry
their history into seasonal progression.

The important part is not the leaderboard itself.

It's the state behind it.

A player's position is the result of what actually happened in their
matches, not something the client is allowed to invent.

---

## Systems

### Placement

Players begin without an established competitive position.

Placement matches are used to establish that initial state before normal
ranked progression begins.

The required placement count is defined centrally through:

```ts
PLACEMENT_MATCHES
```

---

### Matchmaking

Clutch manages the lifecycle of competitive matches from discovery through
resolution.

```text
discovery
   ↓
placement / matchmaking
   ↓
match creation
   ↓
active match
   ↓
resolution
   ↓
rating + progression
```

Resolution is where a match becomes persistent competitive history.

---

### Rating

Rating is maintained within the context of its competitive stack.

The system tracks more than a single number:

```text
rating
peak rating
current win streak
best win streak
season state
final rank
```

A rating earned in one stack does not silently satisfy progression criteria
belonging to another.

---

### Momentum

Streaks are part of competitive state.

They are persisted directly rather than reconstructed from the full match
history every time they're needed.

```text
currentWinStreak
bestWinStreak
```

That makes momentum a piece of the player's record instead of a temporary
UI statistic.

---

### Tournaments

Tournaments introduce a different layer of consequence.

A completed tournament produces a real competitive outcome:

```text
tournament
    ↓
final match
    ↓
champion
    ↓
reward
    ↓
player history
```

Configured reward titles are awarded to the champion when the tournament
completes, with conflict-safe persistence preventing duplicate rewards.

---

### Titles

Titles represent achievements recorded by the system.

They can be tied to things such as:

* rating
* streaks
* tournament rewards

Criteria are evaluated against the correct competitive scope.

A player's rating history in one stack cannot accidentally unlock a title
belonging to another.

---

### Seasons

Seasons create boundaries around competitive history.

At rollover, ranked players are ordered by rating and their final positions
are persisted as `finalRank`.

The old season becomes historical state.

The new season starts fresh.

The history doesn't disappear.

---

## Competitive Integrity

Clutch deliberately separates **player psychology** from **system truth**.

Players can bluff, bait, pressure, adapt, misdirect, or try to manipulate
their opponents.

The system cannot.

A room event that never happened should not appear in the record.

A match that never resolved should not become a result.

A player should not receive a ranking, title, or tournament reward because
the UI decided it would look convincing.

Competitive state comes from actual state transitions.

That distinction is fundamental to Clutch.

---

## Architecture

```text
                           ┌────────────────────┐
                           │       Client       │
                           └─────────┬──────────┘
                                     │
                                     ▼
                           ┌────────────────────┐
                           │        API         │
                           └──────┬─────┬───────┘
                                  │     │
                     ┌────────────┘     └────────────┐
                     ▼                               ▼
              ┌──────────────┐               ┌──────────────┐
              │  PostgreSQL  │               │    Redis     │
              │  persistent  │               │   runtime    │
              │    state     │               │ coordination │
              └──────────────┘               └──────┬───────┘
                                                    │
                                                    ▼
                                             ┌──────────────┐
                                             │    Worker    │
                                             └──────────────┘
```

Clutch is structured as a monorepo with separate application, API, worker,
database, and shared-domain concerns.

The exact package boundaries live in the repository rather than being
abstracted away behind a single application.

---

## Data & State

PostgreSQL is the persistent source of truth for competitive state.

The domain model covers concepts including:

```text
players
identities
stacks
ratings
matches
seasons
tournaments
titles
progression
snapshots
```

Database changes are versioned through migrations.

Competitive progression that is frequently consumed is persisted directly
instead of repeatedly reconstructed from historical match records.

---

## Consistency

Several properties are treated as domain invariants rather than UI
conventions.

### Idempotent resolution

Retried operations must not apply the same competitive side effects twice.

### Scoped progression

Rating, peak rating, streaks, and title criteria remain associated with the
correct competitive stack.

### Persistent progression

State such as streaks and seasonal results is persisted rather than derived
again on every read.

### Canonical rules

Rules such as placement requirements are defined once and reused.

### Real history

The competitive record represents events that actually occurred.

---

## Repository

```text
clutch/
├── apps/
├── packages/
├── package.json
├── ...
└── README.md
```

Clutch is intentionally organized as a monorepo so the application, API,
worker, database, and shared domain logic can evolve together without
duplicating contracts.

---

## Development

### Requirements

* Node.js
* PostgreSQL
* Redis
* npm

### Install

```bash
npm install
```

### Database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### Development

```bash
npm run dev
```

Individual services:

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
```

### Database tooling

```bash
npm run db:studio
```

### Build

```bash
npm run build
```

---

## Testing

Clutch is best tested around domain transitions rather than only rendering
screens.

Core flows include:

```text
placement → ranked

match created → resolved

resolution → rating update

resolution → streak update

rating → title evaluation

tournament completion → champion

tournament completion → reward

season rollover → finalRank

season rollover → new season
```

Important failure cases include:

* repeated match resolution
* duplicate reward processing
* concurrent requests
* invalid state transitions
* invalid stack references
* database failure
* worker interruption
* Redis interruption
* API retries

---

## Recent Engineering

Recent work has tightened several competitive-state boundaries:

* persistent current and best streak state
* stack-aware rating title criteria
* conflict-safe tournament reward titles
* streak data exposed through player-facing APIs
* persisted seasonal `finalRank`
* centralized placement-match configuration

These aren't cosmetic changes.

They're the sort of fixes that prevent competitive state from slowly becoming
inconsistent as the system grows.

---

## Project Status

Core matchmaking, placement, rating, tournament, title, streak, and seasonal
progression systems are implemented.

The current phase is local end-to-end validation.

---

## Philosophy

Clutch is built around a simple premise:

**the match ends when the match ends.
the consequences continue after it.**

The queue gives you an opponent.

The match gives you evidence.

The system keeps the record.

What you do with that record is the competitive part.

---

## License

See `LICENSE`.
