# Clutch

<p align="center">
  <img src="./clutch-logo.svg" alt="Clutch" width="190">
</p>

<p align="center">
  <strong>The code is the game.</strong>
</p>

<p align="center">
  Competitive coding with server-authoritative matches, real code execution,
  ELO, tournaments, seasons, titles, and persistent competitive state.
</p>

<p align="center">
  <code>TypeScript</code> · <code>Next.js</code> · <code>Fastify</code> ·
  <code>PostgreSQL</code> · <code>Redis</code> · <code>BullMQ</code> ·
  <code>Docker</code>
</p>

<p align="center">
  <a href="#what-is-clutch">What is Clutch?</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#execution">Execution</a> ·
  <a href="#development">Development</a> ·
  <a href="#verification">Testing</a>
</p>

---

## What is Clutch?

Clutch is a competitive coding platform built around a simple idea:

**the code is part of the competition.**

A normal coding platform usually ends the loop here:

```text
write
  ↓
submit
  ↓
accepted / rejected
```

Clutch keeps going:

```text
write
  ↓
execute
  ↓
evaluate
  ↓
match
  ↓
resolve
  ↓
rating
  ↓
progression
  ↓
season / tournament / history
```

A player doesn't just accumulate accepted submissions.

They build a competitive record.

Placement establishes an initial position.
Matches create evidence.
Results affect rating and momentum.
Tournaments create higher-stakes outcomes.
Titles preserve achievements.
Seasons give competitive history a boundary without erasing it.

The judge is not separate from the game.

**The judge is part of the competitive state machine.**

---

## The Competitive Loop

```text
                         PLAYER
                            │
                            ▼
                       MATCHMAKING
                            │
                            ▼
                         MATCH
                            │
                    ┌───────┴───────┐
                    │               │
                 QUESTION        SUBMISSION
                                    │
                                    ▼
                                EXECUTION
                                    │
                                    ▼
                                EVALUATION
                                    │
                                    ▼
                                RESOLUTION
                                    │
              ┌─────────────┬───────┼──────────────┐
              ▼             ▼       ▼              ▼
            RATING        STREAK   TITLE       TOURNAMENT
              │                         │              │
              └──────────────┬──────────┘              │
                             ▼                         ▼
                          SEASON ◄─────────────────────┘
```

Everything after execution is driven by actual server-side state.

---

# Core Systems

## Matchmaking

Players enter Clutch through placement and competitive matchmaking.

The server owns the lifecycle of the match:

```text
discovery
   ↓
placement / matchmaking
   ↓
match creation
   ↓
active
   ↓
submission
   ↓
evaluation
   ↓
resolution
```

The client requests actions.

The server determines and persists the competitive outcome.

---

## Placement

Placement is the entry point into competitive rating.

The required placement count is defined centrally through:

```ts
PLACEMENT_MATCHES
```

rather than being duplicated across individual features.

That same rule is consumed wherever placement state matters.

---

## Ratings

Clutch uses ELO-based competitive rating.

Rating exists within the context of the relevant competitive stack.

A player's competitive state can include:

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

Stack-specific progression stays stack-specific.

A peak rating earned in one stack cannot accidentally satisfy a rating
criterion belonging to another.

---

## Streaks

Streaks are persistent competitive state.

```text
currentWinStreak
bestWinStreak
```

They are stored with the player's stack rating rather than reconstructed
through repeated historical match queries.

That makes momentum part of the record rather than a decorative frontend
statistic.

---

## Tournaments

Tournaments turn individual matches into bracket-level progression.

A completed tournament produces an actual competitive outcome:

```text
match resolution
      ↓
tournament state
      ↓
champion
      ↓
reward
      ↓
player progression
```

Tournament reward assignment is conflict-safe, so retries do not silently
duplicate rewards.

---

## Rooms

Rooms provide a persistent competitive context around groups of matches.

Room completion is tied to real match resolution.

When the worker resolves a match, Clutch checks whether the match belongs to a
room and completes the room when its required matches are actually finished.

There is no independent frontend-only "room complete" state.

---

## Titles

Titles represent achievements recorded by the system.

Criteria can be based on competitive state such as:

* rating
* streaks
* tournament rewards
* other progression conditions

Criteria are evaluated against their correct scope.

A title describes something that happened.

It is not a cosmetic number fabricated for presentation.

---

## Seasons

Seasons create boundaries around competitive history.

During rollover:

```text
current season
      ↓
eligible ranked players
      ↓
rating order
      ↓
finalRank
      ↓
season snapshot
      ↓
new season
```

The previous season retains its recorded result.

The new season starts a new progression cycle.

History remains history.

---

# Execution

Clutch has a real multi-language execution layer.

Submitted programs are executed inside runtime-specific Docker environments
rather than being simulated by the frontend.

The current runtime registry supports:

| Language   | Runtime / Toolchain |
| ---------- | ------------------- |
| Python     | Python 3.12         |
| JavaScript | Node.js 20          |
| TypeScript | Node.js 20          |
| C++        | g++ 13.2 / C++17    |
| Java       | JDK 21              |
| Go         | Go 1.22             |
| Rust       | rustc 1.77          |

The frontend discovers available runtimes from the backend through:

```http
GET /meta/languages
```

The language list is therefore derived from the actual runtime registry
rather than maintained as a separate frontend-only list.

---

## Compile and Execute

Interpreted languages follow a direct execution path.

Compiled languages use a compile-then-execute pipeline:

```text
source
  ↓
runtime registry
  ↓
Docker image
  ↓
compile
  ├── compile error
  └── executable
          ↓
       execute
          ↓
      SandboxResult
          ↓
      evaluation
```

Examples:

```text
C++  → g++ → executable → run
Java → javac → JVM → run
Go   → go build → executable → run
Rust → rustc → executable → run
```

The language-specific toolchain lives in the runtime environment.

The competitive domain does not need to know how a particular language is
compiled.

---

## Docker Sandbox

Each execution runs inside an isolated Docker environment.

The sandbox applies resource and execution controls including:

```text
network        disabled
memory         256 MB
CPU            1 core
processes      64
source size    64 KB
output size    256 KB
timeout        language-specific, 10–15 seconds
filesystem     read-only + writable /tmp
user           non-root
capabilities   dropped
privileges     no-new-privileges
```

The execution abstraction is intentionally replaceable.

The domain receives a `SandboxResult` rather than Docker-specific state.

That makes the execution backend replaceable without changing the evaluation
or competitive domain.

---

## Execution Boundary

The current Docker sandbox is designed for development/staging and practical
production-oriented isolation.

Clutch does **not** claim that Docker alone provides high-assurance hostile
code isolation.

The remaining security boundary is the container host and its kernel.

A higher-assurance deployment can move the same execution interface toward
stronger isolation such as microVM-based execution without changing the
competitive domain.

---

# Evaluation

Execution and evaluation are separate concerns.

Evaluation runs asynchronously through BullMQ workers:

```text
API
 │
 ▼
BullMQ
 │
 ▼
Worker
 │
 ├── Sandbox execution
 │
 ├── Similarity detection
 │
 └── Match resolution
        │
        ├── ELO
        ├── Streak
        ├── Titles
        ├── Rooms
        └── Tournament state
```

The worker performs background processing rather than forcing expensive
evaluation work through the HTTP request path.

---

# Real-Time State

Clutch uses WebSockets for live competitive state.

The main match flow is event-driven rather than relying on a three-second
polling loop.

Conceptually:

```text
player submits
      ↓
API
      ↓
BullMQ
      ↓
worker
      ↓
evaluation
      ↓
Redis pub/sub
      ↓
WebSocket
      ↓
player
```

Match events include states such as:

```text
match.found
match.starting
match.active
match.participant_update
submission.queued
submission.result
match.evaluating
match.resolved
match.adjudicated
match.snapshot
observer.snapshot
```

On reconnect, the client can resynchronize against server-owned match state
rather than trusting stale browser state.

Rooms and tournaments use the same underlying realtime infrastructure.

---

# Server Authority

Competitive state belongs to the server.

The client is responsible for:

* presentation
* input
* requests
* local UI state

The server is responsible for:

* match state
* evaluation results
* winners
* rating changes
* progression
* tournament outcomes
* room completion
* seasonal state

The client never gets to manufacture a competitive result.

---

# Account Verification

Clutch includes account email verification using a first-party OTP flow.

```text
registration
     ↓
OTP generation
     ↓
hashed persistence
     ↓
email delivery
     ↓
/verify
     ↓
OTP confirmation
     ↓
emailVerifiedAt
```

Verification codes are:

* cryptographically generated
* stored as hashes
* time-limited
* single-use
* protected by attempt limits
* protected by resend cooldowns

Email delivery is abstracted behind a provider interface.

Development can use a local log delivery mode; SMTP can be configured for real
email delivery through environment variables.

The verification system is intentionally separate from competitive rating,
matchmaking, and progression.

---

# No Fake Competition

Clutch is designed to leave room for player psychology.

Players can:

* pressure opponents
* bluff
* bait predictable reactions
* change tempo
* play around expectations

The platform itself cannot fabricate the underlying facts.

A match result must correspond to an actual match.

A room event must correspond to an actual event.

A ranking must correspond to persisted competitive state.

A title must correspond to an actual achievement.

The psychology belongs to the players.

The record belongs to the system.

---

# Architecture

```text
                              ┌────────────────────┐
                              │      Next.js       │
                              │      Web :3000     │
                              └─────────┬──────────┘
                                        │
                              HTTP + WebSocket
                                        │
                                        ▼
                              ┌────────────────────┐
                              │    Fastify API     │
                              │      :4000         │
                              └──────┬─────┬───────┘
                                     │     │
                         ┌───────────┘     └────────────┐
                         ▼                              ▼
                  ┌──────────────┐               ┌──────────────┐
                  │  PostgreSQL  │               │    Redis     │
                  │ persistent   │               │ pub/sub +    │
                  │ source of    │               │ queues/state │
                  │ truth        │               └──────┬───────┘
                  └──────────────┘                      │
                                                        ▼
                                                 ┌───────────────┐
                                                 │    BullMQ     │
                                                 │    Worker     │
                                                 └──────┬────────┘
                                                        │
                                      ┌─────────────────┼──────────────────┐
                                      ▼                 ▼                  ▼
                               Runtime Registry   Similarity          Match /
                                      │            Detection          ELO
                                      ▼                                     
                              ┌────────────────┐
                              │ Docker Sandbox │
                              └───────┬────────┘
                                      │
                                      ▼
                                  Evaluation
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                       Titles       Rooms     Tournaments
```

---

# Repository

```text
clutch/
├── apps/
│   ├── api/
│   ├── web/
│   └── worker/
│
├── packages/
│   ├── db/
│   ├── domain/
│   └── shared/
│
├── infra/
│   └── sandbox/
│
├── package.json
└── README.md
```

The monorepo is split across six buildable packages covering the application,
API, worker, database, domain logic, and shared contracts.

Sandbox runtime images live under:

```text
infra/sandbox/
```

---

# Development

## Requirements

* Node.js
* pnpm
* PostgreSQL
* Redis
* Docker

## Install

```bash
pnpm install
```

## Infrastructure

Start local infrastructure according to the repository's configured
development environment.

## Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Sandbox Images

Build all runtime images:

```bash
pnpm sandbox:build
```

## Development

Run the complete application:

```bash
pnpm dev
```

Or run services independently:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

## Database Studio

```bash
pnpm db:studio
```

## Build

```bash
pnpm build
```

---

# Testing & Verification

The current repository passes:

```text
203 / 203 tests
0 failures
6 / 6 packages built
Web compilation ✓
Type checking ✓
```

The test surface includes:

```text
authentication
verification
matchmaking
match lifecycle
placement
submission
evaluation
sandbox execution
runtime isolation
ratings
streaks
titles
rooms
tournaments
seasons
WebSockets
```

Sandbox tests cover runtime execution, compile errors, runtime errors, input
and output handling, limits, isolation, and cleanup.

---

# Current Runtime Matrix

```text
┌─────────────┬──────────────────────────────┐
│ Language    │ Toolchain                    │
├─────────────┼──────────────────────────────┤
│ Python      │ Python 3.12                  │
│ JavaScript  │ Node.js 20                   │
│ TypeScript  │ Node.js 20                   │
│ C++         │ g++ 13.2 / C++17             │
│ Java        │ Eclipse Temurin JDK 21       │
│ Go          │ Go 1.22                      │
│ Rust        │ rustc 1.77                   │
└─────────────┴──────────────────────────────┘
```

Each runtime is backed by a dedicated Docker image.

---

# Known Boundaries

Clutch is functional, but some infrastructure work remains before treating
every component as high-assurance production infrastructure.

### Sandbox hardening

The Docker sandbox provides strong practical controls, but higher-assurance
deployments may require additional kernel-level isolation such as custom
seccomp/AppArmor policies or microVM execution.

### Runtime optimization

Compiled runtimes can be improved further with caching and build/runtime
optimizations, especially for cold compilation.

### Editor experience

The current editor is intentionally simpler than a full IDE-style Monaco or
CodeMirror environment.

### Authentication recovery

Password reset and related recovery flows are separate from the current email
verification system.

These are known boundaries, not simulated features.

---

# Engineering Principles

### Server authority

The client never owns competitive truth.

### Actual execution

Submitted programs are really executed and evaluated.

### Persistent progression

Important competitive state is stored rather than needlessly reconstructed.

### Idempotent side effects

Retries must not create duplicate competitive consequences.

### Scoped state

Ratings, progression, and criteria remain attached to the correct competitive
context.

### Explicit infrastructure boundaries

Security boundaries are documented rather than hidden behind marketing claims.

### Runtime isolation

Language toolchains execute inside controlled environments.

### No fabricated competitive history

Clutch does not manufacture matches, rankings, titles, room events, or
results to make the platform appear more active than it is.

---

# Project Status

The core Clutch platform is implemented.

Current systems include:

```text
✓ Authentication
✓ Email verification
✓ Matchmaking
✓ Placement
✓ Match lifecycle
✓ Multi-language execution
✓ Docker sandbox
✓ Evaluation pipeline
✓ ELO rating
✓ Streaks
✓ Titles
✓ Rooms
✓ Tournaments
✓ Seasons
✓ WebSocket match state
✓ Background workers
✓ Persistent competitive state
```

Current verification state:

```text
203 tests passing
6 packages building
Web compilation passing
Web type checking passing
```

Clutch is now in the stage where the priority is **system-level validation,
hardening, and operational testing**, not simulated feature coverage.

---

## License

See `LICENSE`.
