# Clutch

<p align="center">
  <img src="./clutch-logo.svg" alt="Clutch" width="170">
</p>

<p align="center">
  Competitive matchmaking, rating, and progression infrastructure.
</p>

<p align="center">
  <code>TypeScript</code> · <code>PostgreSQL</code> · <code>Redis</code> · <code>Drizzle</code> · <code>Monorepo</code>
</p>

---

## What is Clutch?

Clutch is the backend and application layer for a competitive matchmaking
system.

It handles the parts of competitive play that become difficult once a
game stops being a collection of screens and starts becoming a state
machine:

* placement
* matchmaking
* match lifecycle
* rating
* streaks
* seasons
* tournaments
* titles
* leaderboards
* persistent progression

The important part isn't putting a player into a room.

It's making sure everything that happens **after that** remains consistent.

---

## The Model

Clutch revolves around a few pieces of persistent competitive state:

```text
Player
  │
  ├── Identity
  │
  └── Stack Rating
        │
        ├── Rating
        ├── Peak Rating
        ├── Win Streak
        └── Season State
                │
                ├── Placement
                ├── Rank
                └── Final Rank

Player
  │
  ├── Matches
  ├── Tournaments
  └── Titles
```

A player's competitive state is **scoped, persisted, and derived from actual
domain events**.

The UI doesn't decide who won.

A client doesn't decide what a player's rating is.

A leaderboard doesn't invent activity.

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
                     ┌──────────┘     └──────────┐
                     ▼                           ▼
              ┌──────────────┐           ┌──────────────┐
              │  PostgreSQL  │           │    Redis     │
              │    Source    │           │   Runtime    │
              │   of truth   │           │    state     │
              └──────────────┘           └──────┬───────┘
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │    Worker    │
                                         └──────────────┘
```

The API owns domain operations.

PostgreSQL owns persistent competitive state.

Redis handles runtime coordination where required.

Workers handle asynchronous processing that shouldn't live on the request
path.

---

## Match Lifecycle

A competitive match is a state transition, not a UI event.

```text
discovery
    │
    ▼
placement / matchmaking
    │
    ▼
match created
    │
    ▼
active
    │
    ▼
resolved
    │
    ├── rating
    ├── streak
    ├── progression
    └── tournament state
```

Resolution is where the consequences of a match become persistent
competitive state.

That boundary matters.

If a request is retried, the same match must not produce the same side
effects twice.

---

## Placement

Placement determines a player's initial competitive state.

The number of required placement matches is defined once through
`PLACEMENT_MATCHES`.

There is no reason for the matchmaking system and leaderboard system to
independently decide what "placement" means.

---

## Rating

Ratings are scoped to the competitive stack they belong to.

That distinction is enforced throughout progression.

For example, a rating criterion associated with Stack A cannot accidentally
be satisfied by a player's peak rating from Stack B.

Rating state includes:

```text
current rating
peak rating
current win streak
best win streak
```

Streaks are persisted as part of `user_stack_ratings`.

They are not reconstructed from the complete match history every time a
player card or dashboard is requested.

---

## Seasons

Seasons are snapshots of competitive state, not destructive resets.

During rollover, Clutch:

```text
current season
      │
      ├── eligible players
      │
      ├── rating ordering
      │
      └── finalRank
             │
             ▼
        season snapshot
             │
             ▼
        new season
```

The previous season retains its final competitive state.

The new season starts with its own progression state.

---

## Tournaments

Tournament state is resolved through the same competitive state machinery
rather than being treated as an isolated feature.

When a tournament completes:

1. the champion is determined
2. the tournament state is resolved
3. configured rewards are processed
4. reward titles are assigned

Reward assignment is conflict-safe, so processing the same completion more
than once does not create duplicate rewards.

---

## Titles

Titles are derived from explicit progression criteria.

Criteria can depend on competitive state such as:

* rating
* streak
* tournament rewards

Criteria are evaluated against the correct scope.

A title requirement should never be satisfied simply because a player has
the required number somewhere else in their competitive history.

---

## State Integrity

Clutch is built around a few rules.

### One source of truth

Persistent competitive state belongs to the database.

### Idempotent resolution

A retry must not turn one match into two rating updates.

### Scoped state

Rating, peak rating, streaks, and progression belong to their relevant
competitive context.

### Explicit rules

Domain constants such as `PLACEMENT_MATCHES` have one canonical definition.

### Real state only

Match results, room events, rankings, titles, statistics, and tournament
outcomes represent events that actually happened.

Clutch can shape competitive behavior.

It should never manufacture competitive history.

---

## Repository

```text
clutch/
│
├── apps/
│   ├── web
│   ├── api
│   └── worker
│
├── packages/
│   ├── db
│   └── ...
│
├── package.json
└── README.md
```

The repository is structured as a monorepo so the domain, database, API,
worker, and client layers can share contracts without collapsing into one
runtime.

---

## Local Development

### Requirements

* Node.js
* PostgreSQL
* Redis

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

Run everything:

```bash
npm run dev
```

Or run individual services:

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
```

Database tooling:

```bash
npm run db:studio
```

Build:

```bash
npm run build
```

---

## Development Philosophy

Clutch isn't built around making the leaderboard look busy.

It's built around making competitive state difficult to get wrong.

That means:

* no client-authoritative competitive results
* no fabricated match history
* no cross-stack rating leakage
* no duplicate tournament rewards
* no repeated rating side effects from retries
* no duplicated domain constants
* no unnecessary historical reconstruction of persisted state

The system should be able to survive refreshes, retries, concurrent
requests, worker restarts, and ordinary failure without silently corrupting
competitive state.

---

## Status

Core matchmaking, placement, rating, tournament, title, streak, and seasonal
progression systems are implemented.

The current stage is local end-to-end validation.

---

## License

See `LICENSE`.
