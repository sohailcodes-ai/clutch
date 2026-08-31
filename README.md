# Clutch

<p align="center">
  <img src="./clutch-logo.svg" alt="Clutch" width="190">
</p>

<p align="center">
  <strong>The code is the game.</strong>
</p>

<p align="center">
  A server-authoritative competitive coding platform built around real code execution,
  live matchmaking, persistent ratings, progression, and observable match state.
</p>

<p align="center">
  <code>TypeScript</code> · <code>Next.js 15</code> · <code>Fastify 5</code> ·
  <code>PostgreSQL</code> · <code>Redis</code> · <code>BullMQ</code> · <code>Docker</code>
</p>

---

## What is Clutch?

Most coding platforms treat a submission as the end of the experience.

```text
write
  ↓
submit
  ↓
accepted / rejected
```

Clutch treats the submission as part of a larger competitive state machine.

```text
register
  ↓
verify
  ↓
onboard
  ↓
queue
  ↓
match
  ↓
ready
  ↓
compete
  ↓
submit
  ↓
execute
  ↓
evaluate
  ↓
resolve
  ↓
rating update
  ↓
progression
  ↓
play again
```

The important distinction is that **the browser does not decide what happened**.

A player can request a submission.

They cannot decide whether it passed.

A player can request readiness.

They cannot decide whether the match started.

A player can receive a result.

They cannot manufacture the result.

Competitive state is owned by the backend, persisted in the database, processed asynchronously where necessary, and propagated to clients through the realtime layer.

That's the foundation Clutch is built around.

---

# Season 01

Season 01 is focused on one thing:

**making the competitive loop actually work end-to-end.**

The launch experience is centered around:

```text
Register
   ↓
Verify
   ↓
Onboard
   ↓
Join Queue
   ↓
Match Found
   ↓
Ready
   ↓
Compete
   ↓
Submit
   ↓
Evaluate
   ↓
Resolve
   ↓
Rating Update
   ↓
Play Again
```

Spectator mode is part of Season 01.

Tournament UX is intentionally **not** part of the Season 01 launch loop, even though tournament infrastructure already exists in the platform.

This distinction matters because Clutch is being validated as a competitive system rather than as a collection of disconnected screens.

---

# The Core Idea

Clutch has three boundaries that matter.

### The client owns interaction.

The web application handles:

* rendering
* input
* local UI state
* optimistic presentation where appropriate
* WebSocket subscriptions
* API requests

### The server owns competition.

The backend determines:

* match state
* participants
* readiness
* submissions
* evaluation results
* winners
* rating changes
* progression
* room state
* seasonal state

### The worker owns expensive asynchronous work.

Background processing handles:

* matchmaking sweeps
* submission evaluation
* sandbox execution
* match resolution
* season lifecycle processing

The result is a system where the UI is a projection of competitive state rather than the source of it.

---

# Architecture

```text
                              ┌──────────────────────┐
                              │       Next.js        │
                              │       Web :3000      │
                              └──────────┬───────────┘
                                         │
                                  HTTP + WebSocket
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │      Fastify 5       │
                              │       API :4000      │
                              └───────┬──────┬───────┘
                                      │      │
                         ┌────────────┘      └──────────────┐
                         ▼                                  ▼
                ┌────────────────┐                  ┌────────────────┐
                │   PostgreSQL   │                  │     Redis      │
                │                │                  │                │
                │ source of      │                  │ queues         │
                │ persistent     │                  │ pub/sub        │
                │ competitive    │                  │ transient      │
                │ state          │                  │ coordination   │
                └────────────────┘                  └───────┬────────┘
                                                            │
                                                            ▼
                                                     ┌──────────────┐
                                                     │    BullMQ    │
                                                     │    Worker    │
                                                     └──────┬───────┘
                                                            │
                              ┌─────────────────────────────┼────────────────────────┐
                              │                             │                        │
                              ▼                             ▼                        ▼
                       Matchmaking                    Evaluation              Season Lifecycle
                              │                             │
                              │                             ▼
                              │                     ┌───────────────┐
                              │                     │ Runtime Layer │
                              │                     └───────┬───────┘
                              │                             │
                              │                             ▼
                              │                     ┌───────────────┐
                              │                     │ Docker Sandbox│
                              │                     └───────┬───────┘
                              │                             │
                              │                             ▼
                              │                        Test Cases
                              │                             │
                              └─────────────────────────────┤
                                                            ▼
                                                       Resolution
                                                            │
                              ┌─────────────────────────────┼───────────────────────┐
                              ▼                             ▼                       ▼
                           Rating                        Streaks                 Titles
                              │                             │                       │
                              └─────────────────────────────┼───────────────────────┘
                                                            ▼
                                                        Player State
```

The architecture is intentionally split by responsibility.

`apps/api` handles network-facing operations.

`apps/worker` handles asynchronous processing.

`packages/domain` contains the competitive rules.

`packages/db` owns persistence.

`packages/shared` contains contracts and shared constants.

The frontend consumes the resulting state.

It does not define it.

---

# Monorepo

```text
clutch/
│
├── apps/
│   ├── api/                  # Fastify HTTP + WebSocket server
│   ├── web/                  # Next.js application
│   └── worker/               # BullMQ background worker
│
├── packages/
│   ├── db/                   # Drizzle schema, migrations, database client
│   ├── domain/               # Competitive business logic
│   └── shared/               # Schemas, constants and shared contracts
│
├── e2e/                      # Season 01 end-to-end verification
│
├── infra/
│   └── sandbox/              # Runtime Docker images
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Clutch uses a pnpm workspace so application boundaries remain explicit while domain code, persistence, and shared contracts can evolve together.

---

# Matchmaking

Matchmaking is worker-driven rather than implemented as a frontend timer.

The general flow is:

```text
player joins queue
       ↓
persistent queue state
       ↓
matchmaking sweep
       ↓
eligible players grouped
       ↓
match created
       ↓
participants notified
```

The matchmaking worker runs on a short sweep interval and operates against server-owned state.

The client can request entry into the queue.

It cannot create a match by itself.

This matters because matchmaking is one of the first places where a client-authoritative design becomes exploitable.

---

# Match Lifecycle

A match is a persisted state machine.

Conceptually:

```text
created
   ↓
ready
   ↓
active
   ↓
submission
   ↓
evaluating
   ↓
resolved
```

The match lifecycle has explicit timing constraints.

```text
READY_WINDOW_SEC = 30
MATCH_TIME_LIMIT_SEC = 900
```

Actions such as readiness and submission use server-side validation and idempotency keys.

For example, a ready request requires an `idempotencyKey`.

A submission requires:

```text
sourceCode
idempotencyKey
isFinal
```

This allows retries to remain safe without turning network instability into duplicate competitive side effects.

---

# Real Code Execution

Clutch does not fake evaluation.

Submitted source code is actually executed.

The current runtime registry supports:

| Language   | Toolchain              |
| ---------- | ---------------------- |
| Python     | Python 3.12            |
| JavaScript | Node.js 20             |
| TypeScript | Node.js 20             |
| C++        | g++ 13.2 / C++17       |
| Java       | Eclipse Temurin JDK 21 |
| Go         | Go 1.22                |
| Rust       | rustc 1.77             |

The frontend does not maintain its own independent language catalog.

It discovers available runtimes through:

```http
GET /meta/languages
```

That means the languages presented to the user come from the backend runtime registry.

---

# Execution Pipeline

Execution is separated from competitive logic.

```text
source code
    │
    ▼
runtime registry
    │
    ▼
sandbox image
    │
    ├──────── compile
    │           │
    │           ├── failure
    │           │
    │           └── executable
    │
    └──────── execute
                │
                ▼
          SandboxResult
                │
                ▼
            Evaluation
```

Compiled languages use their native toolchains.

```text
C++   → g++    → executable → run
Java  → javac  → JVM        → run
Go    → build  → executable → run
Rust  → rustc  → executable → run
```

The domain layer does not need to know how a language is compiled.

It consumes the execution result.

That separation makes the runtime layer replaceable.

---

# Sandbox

Production-oriented execution uses Docker isolation.

The sandbox currently applies controls including:

```text
network        disabled
memory         256 MB
CPU            1 core
processes      64
source size    64 KB
output size    256 KB
timeout        10–15 seconds
filesystem     read-only + writable /tmp
user           non-root
capabilities   dropped
privileges     no-new-privileges
```

Development can use:

```text
SANDBOX_MODE=child_process
```

Production explicitly rejects the child-process execution mode.

This is enforced rather than relying on deployment convention.

### Security boundary

Docker is treated as an isolation boundary, not as a claim of perfect hostile-code security.

Container isolation ultimately depends on the host kernel and runtime configuration.

For a higher-assurance deployment, the execution interface can be moved toward stronger isolation such as microVM-based execution without requiring the competitive domain to change.

---

# Evaluation

Evaluation is asynchronous.

The API creates the submission and queues evaluation work:

```text
API
 │
 ▼
BullMQ
 │
 ▼
Worker
 │
 ├── execute
 ├── evaluate test cases
 ├── determine submission result
 └── resolve match
          │
          ├── winner
          ├── rating
          ├── streak
          ├── titles
          └── progression
```

The evaluation queue is:

```text
submission-evaluation
```

This keeps expensive execution work outside the HTTP request path.

A submission can therefore move through explicit states rather than making the API request itself responsible for the entire execution lifecycle.

---

# Ratings & Placement

Clutch uses ELO-based competitive rating.

New players enter through placement matches.

```text
placement
    ↓
initial competitive state
    ↓
ranked matches
    ↓
rating changes
```

Placement count is centrally defined through:

```ts
PLACEMENT_MATCHES
```

rather than duplicated across unrelated features.

Rating calculation uses K-factor tiers and operates within the relevant competitive stack.

Competitive state can include:

```text
rating
peak rating
placement state
current win streak
best win streak
season
final rank
titles
```

Stack-scoped state is deliberately kept scoped.

A rating or achievement in one competitive stack must not accidentally satisfy criteria belonging to another.

---

# Streaks

Streaks are persistent state.

```text
currentWinStreak
bestWinStreak
```

They are stored with the relevant player rating state instead of being reconstructed from the entire match history every time the value is needed.

This makes streaks part of the domain model rather than a derived UI decoration.

---

# Titles

Titles represent recorded achievements.

The system currently supports multiple title criteria types covering competitive state such as:

* rating
* streaks
* tournament rewards
* progression conditions

Criteria are evaluated against the correct competitive scope.

A title is therefore evidence of a persisted achievement, not simply a badge that the frontend decides to display.

---

# Seasons

Seasons provide a boundary around competitive progression without destroying historical state.

At rollover:

```text
active season
     ↓
eligible ranked players
     ↓
rating order
     ↓
final rank
     ↓
season snapshot
     ↓
new season
```

The previous season retains its final result.

The new season starts a new competitive progression cycle.

This allows the system to have seasonal competition without treating historical data as disposable.

---

# Spectating

Spectator mode is part of Season 01.

Observers receive server-owned match state through the same realtime infrastructure used by active participants.

The observer model is intentionally read-only.

```text
participant
    │
    ▼
competitive state
    │
    ├──────── player client
    │
    └──────── observer client
```

A spectator can observe the match.

They cannot mutate competitive state.

---

# WebSockets

Clutch uses WebSockets for live match state.

The frontend exposes:

```ts
useWs()
```

with connection state such as:

```text
connecting
connected
reconnecting
disconnected
```

The realtime flow is conceptually:

```text
player action
     ↓
HTTP API
     ↓
persistent state
     ↓
worker / evaluation
     ↓
event publication
     ↓
WebSocket
     ↓
clients
```

Relevant events include:

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

The WebSocket layer is not the source of truth.

It is a transport mechanism for server-owned state.

On reconnect, clients can resynchronize against the authoritative match snapshot instead of assuming their previous browser state is still correct.

---

# Authentication & Verification

Competitive actions require authenticated sessions.

Sessions use:

```text
32-byte random token
        ↓
SHA-256 hash
        ↓
auth_sessions
        ↓
7-day TTL
        ↓
clutch_session cookie
```

Email verification is enforced before entering competitive flows such as queue participation and submissions.

The verification system uses:

```text
6-digit OTP
     ↓
SHA-256 hash
     ↓
verification_tokens
     ↓
attempt limits
     ↓
resend cooldown
     ↓
single-use verification
```

Development email delivery can log verification codes locally.

Production can use SMTP through the delivery abstraction.

The verification layer is separate from competitive progression so account security does not become entangled with rating logic.

---

# Redis Compatibility

Clutch is tested against the actual infrastructure versions it supports.

One production compatibility issue exposed during development was Redis 3.0's lack of support for multi-field `HSET`.

The matchmaking state path was therefore implemented using `HMSET` for compatibility with Redis 3.0.504.

This is a small detail, but it illustrates an important principle:

**the system is validated against the infrastructure it actually runs on, not an assumed modern dependency stack.**

---

# Persistence

PostgreSQL is the persistent source of truth.

Drizzle ORM provides the database layer.

The database contains persistent competitive state including:

```text
users
sessions
verification tokens
seasons
matches
participants
submissions
ratings
rating ledger
titles
rooms
tournaments
```

The database client uses a singleton pattern so application subsystems share the intended connection instance rather than accidentally creating competing lifecycle-managed clients.

---

# Background Processing

The worker handles periodic and asynchronous jobs.

Current sweep intervals include:

```text
matchmaking       2s
evaluation       15s
season lifecycle 60s
```

This keeps periodic work outside the request/response layer.

The worker is also responsible for consequences that should happen exactly once from the perspective of competitive state.

That means retry safety and idempotency are treated as domain requirements rather than infrastructure afterthoughts.

---

# Observability

The API exposes request identifiers and metrics.

Every response can be correlated through a request ID, making failures easier to trace across:

```text
browser
  ↓
API
  ↓
database / Redis
  ↓
queue
  ↓
worker
  ↓
evaluation
```

A metrics endpoint is available at:

```http
GET /metrics
```

The goal is not simply to know that "something failed."

The goal is to be able to identify which subsystem failed and follow the request through the system.

---

# E2E Verification

Unit tests alone are not enough for a system like Clutch.

The Season 01 test suite runs an in-process Fastify server against real infrastructure:

```text
Fastify
   │
   ├── real PostgreSQL
   ├── real Redis
   ├── real domain logic
   ├── real matchmaking
   ├── real evaluation
   └── real sandbox execution
```

The E2E suite verifies the complete competitive path rather than mocking the critical infrastructure boundaries.

The happy path covers:

```text
1. registration
2. duplicate registration rejection
3. verification
4. onboarding
5. profile/stat state
6. queue entry
7. matchmaking
8. match discovery
9. ready state
10. competition
11. submission
12. evaluation
13. match resolution
14. rating update
15. history
16. reconnect/state synchronization
17. play again
```

The test suite also dynamically determines the question assigned to the match instead of assuming a particular seeded question.

This matters because the E2E test verifies the system rather than accidentally verifying one hardcoded fixture.

---

# Verification Status

Current repository verification:

```text
272 / 272 unit tests       ✓
36 / 36 E2E tests          ✓
308 total tests            ✓
6 packages building        ✓
Web compilation            ✓
Web type checking          ✓
Season 01 happy path       ✓
```

The Season 01 E2E suite has passed across consecutive runs.

The critical competitive path has therefore been exercised through the actual application stack rather than only through isolated unit tests.

---

# Seeded Competitive Content

The development database currently contains:

```text
16 seeded questions
63 test cases
1 active season
13 competitive stacks
```

The seeded question set includes:

```text
sum-two-numbers
```

alongside the remaining competitive question fixtures.

Question selection is server-controlled.

The client does not choose which competitive question is assigned to a match.

---

# Project Status

Clutch has moved beyond basic feature implementation.

The current priority is **system-level validation and operational hardening**.

Implemented systems include:

```text
✓ Authentication
✓ Session management
✓ Email verification
✓ Onboarding
✓ Matchmaking
✓ Placement matches
✓ Match lifecycle
✓ Server-authoritative state
✓ Multi-language execution
✓ Docker sandbox
✓ Asynchronous evaluation
✓ ELO rating
✓ Persistent streaks
✓ Titles
✓ Rooms
✓ Tournaments
✓ Seasons
✓ WebSocket state
✓ Spectator infrastructure
✓ Background workers
✓ Match history
✓ Rating history
✓ Observability
✓ E2E competitive verification
```

Season 01 is specifically focused on validating the core competitive loop and spectator experience.

---

# Known Engineering Boundaries

Clutch is functional, but there are deliberate areas that remain below high-assurance production infrastructure.

### Sandbox isolation

Docker provides practical isolation and resource controls.

It is not presented as a perfect hostile-code boundary.

Higher-assurance deployments can move execution toward microVMs or stronger kernel-level isolation.

### Runtime performance

Cold compilation remains an optimization target for compiled languages.

Future improvements can include build caching and runtime reuse.

### Editor

The current editor is intentionally lighter than a full IDE environment.

A more advanced editor experience can be added without changing the competitive backend.

### Account recovery

Email verification is implemented.

Password recovery and broader account recovery flows remain separate work.

These are documented boundaries rather than hidden gaps.

---

# Engineering Principles

### Server authority

The client requests state transitions.

The server decides whether they happen.

### Real execution

Submitted programs are actually executed.

### Persistent competitive state

Important state is stored rather than repeatedly reconstructed from presentation-layer data.

### Idempotent side effects

Retries must not create duplicate ratings, rewards, submissions, or other competitive consequences.

### Scoped state

Ratings, titles, and progression criteria operate within their intended competitive context.

### Asynchronous by design

Expensive execution and background lifecycle work are handled outside latency-sensitive HTTP paths.

### Explicit trust boundaries

Security assumptions are documented rather than hidden behind vague claims.

### Replaceable infrastructure

The competitive domain should not care whether execution is backed by Docker, a stronger sandbox, or another runtime implementation.

### No fabricated competition

Matches, rankings, titles, rewards, and results represent actual persisted system state.

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

## Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Sandbox

Build the runtime images:

```bash
pnpm sandbox:build
```

## Development

Run the complete application:

```bash
pnpm dev
```

Or run individual services:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

## Build

```bash
pnpm build
```

## Database Studio

```bash
pnpm db:studio
```

## Tests

Run unit tests:

```bash
pnpm test
```

Run Season 01 E2E tests:

```bash
pnpm test:e2e
```

---

# Stack

```text
Frontend
  Next.js 15
  React
  TypeScript

API
  Fastify 5
  WebSockets

Domain
  TypeScript
  server-authoritative business logic

Persistence
  PostgreSQL
  Drizzle ORM

Infrastructure
  Redis
  BullMQ
  Docker

Execution
  Python
  Node.js
  g++
  JDK
  Go
  Rust

Testing
  Vitest
  E2E integration tests
  real PostgreSQL
  real Redis
  real sandbox execution
```

---

# Why Clutch Exists

Clutch is an experiment in treating competitive programming less like a submission form and more like a multiplayer system.

The interesting engineering problem isn't rendering a code editor.

It's making the entire chain trustworthy:

```text
player
  ↓
intent
  ↓
server
  ↓
persistent state
  ↓
matchmaking
  ↓
execution
  ↓
evaluation
  ↓
resolution
  ↓
rating
  ↓
history
```

Every transition is an opportunity for race conditions, duplicated side effects, stale client state, inconsistent persistence, infrastructure failures, or incorrect authority boundaries.

Clutch is built around making those boundaries explicit.

**The code is the game.**

And the system has to be able to prove what happened.

---

## License

See `LICENSE`.
