# Clutch

<p align="center">
  <img src="./clutch-logo.svg" alt="Clutch" width="190">
</p>

<p align="center">
  <strong>Competitive coding, without the fake scoreboard.</strong>
</p>

<p align="center">
  Server-authoritative matchmaking · Real code execution · ELO · Tournaments · Seasons
</p>

<p align="center">
  <a href="#what-is-clutch">What is Clutch?</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#local-development">Development</a> ·
  <a href="#testing">Testing</a>
</p>

---

## What is Clutch?

Clutch is a competitive coding platform built around the idea that the
competitive layer should be part of the game itself, not something bolted
onto a submission form afterward.

You write code.

You run it.

You enter a match.

Your code is evaluated by the platform.

The result changes the match.

The match changes your rating.

The rating changes your position.

That position follows you into rooms, tournaments, titles, and seasons.

```text
                 CODE
                  │
                  ▼
             EXECUTION
                  │
                  ▼
             EVALUATION
                  │
                  ▼
                MATCH
                  │
          ┌───────┴───────┐
          ▼               ▼
        RESULT         RATING
          │               │
          ▼               ▼
       ROOM /         PROGRESSION
      TOURNAMENT           │
          │                ▼
          └──────────►  SEASON
```

Clutch is not a leaderboard wrapped around a coding judge.

The judge is part of the competitive state machine.

---

## The Competitive Layer

Most coding platforms stop at:

```text
submit → accepted / rejected
```

Clutch continues:

```text
submit
  ↓
execute
  ↓
evaluate
  ↓
resolve
  ↓
match outcome
  ↓
ELO
  ↓
streak
  ↓
titles / progression
  ↓
seasonal state
```

A match is therefore not just a page where two players happen to be
displayed next to each other.

It is a persistent competitive event with consequences.

---

## Matchmaking

Players enter the system through placement and matchmaking.

The platform maintains match lifecycle state on the server and performs
competitive resolution away from the client.

The client can request actions.

It does not get to decide the result.

```text
player
  │
  ▼
matchmaking
  │
  ▼
match
  │
  ├── question
  ├── submissions
  ├── execution
  └── evaluation
          │
          ▼
       resolution
          │
          ├── winner
          ├── ELO
          ├── streak
          ├── progression
          └── tournament / room state
```

---

## Real Code Execution

Clutch runs submitted programs through an execution pipeline rather than
pretending that an evaluation happened.

The current sandbox provides:

* environment-variable stripping
* temporary working directories
* timeout enforcement
* output-size limits
* source-size limits
* process cleanup

The execution boundary is defined behind a swappable `SandboxResult`
interface.

That means the domain does not need to know whether code is eventually being
executed through the current process-based sandbox, Docker, or a stronger
isolation layer.

### Production boundary

The development/staging executor currently uses `child_process`.

That is **not** an acceptable isolation boundary for arbitrary hostile code
in production.

The intended production boundary is a container or microVM-based executor
with controls such as:

```text
network = disabled
memory = limited
cpu = limited
filesystem = isolated
process count = limited
privileged mode = disabled
```

The execution interface already exists to make that replacement without
rewriting the competitive domain.

---

## Evaluation

Execution and evaluation are separate concerns.

The evaluation pipeline consumes submitted code, executes it, produces a
result, and feeds that result back into the competitive system.

The worker handles evaluation asynchronously through BullMQ.

```text
                API
                 │
                 ▼
           BullMQ Queue
                 │
                 ▼
             Worker
                 │
                 ▼
             Sandbox
                 │
                 ▼
            Evaluation
                 │
        ┌────────┴────────┐
        ▼                 ▼
   Similarity          Match
   detection         resolution
                         │
                         ▼
                       ELO
```

---

## Ratings

Clutch uses ELO-based competitive rating.

Rating is not treated as an isolated database number. It is part of a larger
player state that can include:

```text
current rating
peak rating
current win streak
best win streak
season
final rank
titles
tournament history
```

Ratings are scoped to the relevant competitive stack.

A rating earned in one stack must not accidentally satisfy progression
criteria belonging to another.

---

## Placement

Placement is where a player's competitive state begins.

The system uses the shared:

```ts
PLACEMENT_MATCHES
```

constant as the canonical definition of the placement requirement.

Placement is part of matchmaking state, not a hardcoded frontend experience.

---

## Rooms

Rooms provide a persistent space around competitive matches.

Room lifecycle is tied to actual match state.

When the worker resolves a match, it checks whether that match belongs to a
room and completes the room when its required matches have actually
finished.

There is no separate fake "room complete" state floating above the real
match state.

---

## Tournaments

Tournaments turn individual matches into bracket-level progression.

A tournament completion can produce:

```text
match resolution
      ↓
tournament state
      ↓
champion
      ↓
reward
      ↓
title / progression
```

Tournament reward insertion is conflict-safe so retries do not create
duplicate rewards.

---

## Titles & Progression

Titles represent recorded achievements.

They can be driven by explicit criteria such as:

* rating
* streaks
* tournament rewards
* other progression state

Criteria are evaluated against the correct competitive scope.

The system does not unlock a stack-specific rating title using an unrelated
rating from another stack.

---

## Seasons

Competitive history is divided into seasons.

At rollover, eligible ranked players are ordered by rating and their final
positions are persisted as `finalRank`.

```text
current season
      │
      ▼
ranked players
      │
      ▼
rating order
      │
      ▼
finalRank
      │
      ▼
season snapshot
      │
      ▼
new season
```

The new season resets its progression state.

The old one remains history.

---

## Server Authority

Clutch treats competitive state as server-owned state.

The client is responsible for presentation and requests.

The server is responsible for deciding and persisting:

* match state
* evaluation results
* winners
* rating changes
* progression
* tournament outcomes
* room completion
* seasonal state

This matters because a competitive coding platform becomes meaningless
the moment the client can manufacture its own competitive history.

---

## No Fake Competition

Clutch deliberately leaves room for psychology and player interaction.

Players can pressure each other.

They can bluff.

They can play around expectations.

They can manipulate what another player *thinks* is happening.

The platform itself does not get to lie.

A match result has to correspond to a real match.

A room event has to correspond to a real event.

A ranking has to correspond to real persisted state.

A title has to correspond to an actual achievement.

The system can create uncertainty for players.

It should never create false facts.

---

## Architecture

```text
                         ┌───────────────────┐
                         │     Next.js Web   │
                         │       :3000       │
                         └─────────┬─────────┘
                                   │
                    HTTP / WebSocket / Polling
                                   │
                                   ▼
                         ┌───────────────────┐
                         │    Fastify API    │
                         │       :4000       │
                         └──────┬─────┬──────┘
                                │     │
                       ┌────────┘     └──────────┐
                       ▼                         ▼
                ┌───────────────┐        ┌───────────────┐
                │  PostgreSQL   │        │     Redis     │
                │ persistent    │        │ queues/state  │
                │ source        │        └───────┬───────┘
                │ of truth      │                │
                └───────────────┘                ▼
                                         ┌─────────────────┐
                                         │ BullMQ / Worker │
                                         └────────┬────────┘
                                                  │
                                ┌─────────────────┼─────────────────┐
                                ▼                 ▼                 ▼
                             Sandbox         Similarity        Match / ELO
                           execution         detection         resolution
                                                                    │
                                      ┌─────────────────────────────┤
                                      ▼             ▼               ▼
                                    Titles        Rooms          Tournaments
```

---

## Repository

```text
clutch/
├── apps/
│   ├── api
│   ├── web
│   └── worker
│
├── packages/
│   ├── db
│   ├── domain
│   └── shared
│
├── package.json
└── README.md
```

The repository currently contains six buildable packages covering the web
application, API, worker, database, domain logic, and shared contracts.

---

## Local Development

### Requirements

* Node.js
* PostgreSQL
* Redis
* pnpm

### Install

```bash
pnpm install
```

### Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### Development

Start the complete development environment:

```bash
pnpm dev
```

Or run services independently:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

### Database tooling

```bash
pnpm db:studio
```

### Build

```bash
pnpm build
```

---

## Testing

The current repository has a full automated test suite covering the core
domain and application behavior.

```text
13 test files
159 tests
159 passed
```

All six packages currently build successfully, including the web application
with compilation and type checking.

The important test surface is not just UI rendering.

It includes the transitions that create and modify competitive state:

```text
placement
match creation
match resolution
evaluation
rating
streaks
titles
rooms
tournaments
seasons
```

---

## Current Runtime

The current runtime registry exposes available language environments to the
frontend through:

```http
GET /meta/languages
```

The frontend derives available stacks from the backend runtime registry
instead of maintaining a separate hardcoded language list.

This means the set of executable languages comes from the execution layer
that actually exists.

---

## What's Real

The following systems are implemented and wired end-to-end:

| System              | Status |
| ------------------- | ------ |
| Authentication      | Real   |
| Matchmaking         | Real   |
| Match lifecycle     | Real   |
| Code execution      | Real   |
| Evaluation pipeline | Real   |
| ELO rating          | Real   |
| Questions           | Real   |
| Titles              | Real   |
| Seasons             | Real   |
| Rooms               | Real   |
| Tournaments         | Real   |
| WebSockets          | Real   |
| Background workers  | Real   |

---

## Known Infrastructure Boundaries

Clutch is functional, but not every production hardening layer is complete.

The current execution sandbox uses process isolation rather than Docker or
microVM isolation.

Additional production work includes:

* hardened code sandboxing
* additional language runtimes
* WebSocket-driven match updates
* richer code editing experience
* authentication recovery flows

The important distinction is that these are **known boundaries**, not
hidden behind simulated functionality.

---

## Engineering Principles

### Server authority

Competitive outcomes belong to the server.

### Actual execution

Submitted code is executed through the evaluation pipeline.

### Persistent state

Important progression is stored rather than reconstructed unnecessarily.

### Idempotent side effects

Retries must not duplicate competitive consequences.

### Scoped state

Rating and progression stay attached to their correct stack and season.

### Explicit infrastructure boundaries

Unsafe execution boundaries are documented rather than pretending they are
production-safe.

### No fabricated competitive history

The platform does not manufacture matches, rankings, room events, titles, or
results for appearance.

---

## Status

Clutch's core competitive platform is implemented and currently undergoing
local end-to-end validation.

The current build passes:

```text
159 / 159 tests
6 / 6 packages built
Web compilation ✓
Type checking ✓
```

---

## License

See `LICENSE`.

