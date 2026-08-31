# Clutch

<p align="center">
  <img src="./clutch-logo.svg" alt="Clutch" width="190">
</p>

<p align="center">
  <strong>The code is the game.</strong>
</p>

<p align="center">
  A server-authoritative competitive coding platform built around real code execution,
  realtime matchmaking, persistent ratings, progression, and observable competitive state.
</p>

<p align="center">
  <code>TypeScript</code> ·
  <code>Next.js 15</code> ·
  <code>Fastify 5</code> ·
  <code>PostgreSQL</code> ·
  <code>Redis</code> ·
  <code>BullMQ</code> ·
  <code>Docker</code>
</p>

---

## Overview

Clutch is a competitive programming platform designed around one principle:

> Competitive state belongs to the server.

Players can queue, compete, submit code, spectate matches, progress through rankings, unlock titles, and build competitive history.

The browser handles interaction.

The backend determines what actually happened.

A match result, submission result, rating update, title award, or progression event is not accepted because a client says it happened. Competitive state is validated by backend services, persisted in PostgreSQL, processed asynchronously where necessary, and propagated through the realtime layer.

```text
Player Intent
      ↓
HTTP / WebSocket
      ↓
Server Validation
      ↓
Persistent State
      ↓
Queue / Worker
      ↓
Code Execution
      ↓
Evaluation
      ↓
Match Resolution
      ↓
Rating + Progression
      ↓
Realtime State Update
```

---

# Project at a Glance

| Area                   | Scale |
| ---------------------- | ----: |
| Workspace packages     |     6 |
| TypeScript files       |  222+ |
| Frontend pages         |    27 |
| Database tables        |    43 |
| Database enums         |    19 |
| Domain service modules |    38 |
| HTTP routes            |   101 |
| WebSocket events       |    75 |
| Supported languages    |     7 |
| Competitive questions  |   111 |
| Difficulty bands       |     9 |
| Competitive titles     |    72 |
| Unit tests             |   307 |
| E2E tests              |    63 |
| Total tests            |   370 |
| SQL migrations         |    10 |

Clutch is structured as a monorepo containing the web application, API, background worker, domain logic, persistence layer, and shared contracts.

---

# Core Competitive Loop

The primary system is built around a complete competitive lifecycle.

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
Submit Code
   ↓
Execute
   ↓
Evaluate
   ↓
Resolve Match
   ↓
Rating Update
   ↓
Titles + Progression
   ↓
Play Again
```

The client participates in this lifecycle.

It does not authoritatively control it.

---

# Season 01

Season 01 focuses on validating the competitive loop end-to-end.

The launch experience is centered around:

```text
Queue
  ↓
Match
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
Rating
  ↓
Progress
```

Spectator functionality is included in the Season 01 competitive experience.

Additional systems such as tournaments, rooms, social features, challenges, and events exist within the platform architecture, but are not treated as required dependencies for validating the initial competitive loop.

The goal of Season 01 is not to ship the maximum number of screens.

The goal is to verify that the competitive system behaves correctly under the actual application stack.

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
                │ persistent     │                  │ queues         │
                │ competitive    │                  │ pub/sub        │
                │ state          │                  │ coordination   │
                └────────────────┘                  └───────┬────────┘
                                                            │
                                                            ▼
                                                     ┌──────────────┐
                                                     │    BullMQ    │
                                                     │    Worker    │
                                                     └──────┬───────┘
                                                            │
                          ┌─────────────────────────────────┼─────────────────────────────────┐
                          ▼                                 ▼                                 ▼
                    Matchmaking                       Evaluation                       Season Lifecycle
                          │                                 │
                          │                                 ▼
                          │                         ┌───────────────┐
                          │                         │ Runtime Layer │
                          │                         └───────┬───────┘
                          │                                 │
                          │                                 ▼
                          │                         ┌───────────────┐
                          │                         │ Docker Sandbox│
                          │                         └───────┬───────┘
                          │                                 │
                          └─────────────────────────────────┼─────────────────────────────────┘
                                                            ▼
                                                       Resolution
                                                            │
                                  ┌─────────────────────────┼─────────────────────────┐
                                  ▼                         ▼                         ▼
                               Rating                   Progression                 Realtime
                                  │                         │                         │
                                  └─────────────────────────┼─────────────────────────┘
                                                            ▼
                                                     Player State
```

---

# System Boundaries

Clutch separates responsibility between the client, API, worker, domain layer, and persistence layer.

## Client

The web application owns:

* rendering
* input
* local UI state
* optimistic presentation where appropriate
* HTTP requests
* WebSocket subscriptions

## API

The API owns network-facing operations including:

* authentication
* validation
* authorization
* competitive action requests
* profile access
* matchmaking entry
* submission creation
* realtime event delivery

## Worker

The worker handles asynchronous and periodic operations including:

* matchmaking sweeps
* submission evaluation
* sandbox execution
* match resolution
* progression evaluation
* season lifecycle processing

## Domain

The domain layer contains competitive rules such as:

* matchmaking logic
* match state transitions
* rating calculation
* title evaluation
* season logic
* tournament logic
* social and challenge rules

## Database

PostgreSQL is the persistent source of truth for competitive state.

Redis is used for transient coordination, queues, caching, and realtime infrastructure.

---

# Repository Structure

```text
clutch/
│
├── apps/
│   ├── api/                  # Fastify HTTP + WebSocket server
│   ├── web/                  # Next.js application
│   └── worker/               # BullMQ background processing
│
├── packages/
│   ├── db/                   # Drizzle schema, migrations, seed data
│   ├── domain/               # Competitive business logic
│   └── shared/               # Schemas, constants and contracts
│
├── e2e/                      # End-to-end integration verification
│
├── infra/
│   └── sandbox/              # Runtime Docker images
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

# Competitive Match Lifecycle

Matches are persisted state machines.

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

Competitive transitions are validated server-side.

Players can request actions.

The system determines whether those actions are valid.

Match operations also use idempotency protection where duplicate requests could otherwise create duplicate competitive side effects.

Examples include:

```text
ready request
submission request
evaluation work
rating updates
progression awards
```

Network retries should not create duplicate ratings, submissions, rewards, or other persistent competitive consequences.

---

# Matchmaking

Matchmaking is worker-driven.

```text
Player joins queue
        ↓
Persistent queue state
        ↓
Matchmaking sweep
        ↓
Eligible players compared
        ↓
Match created
        ↓
Participants notified
```

Rating search ranges expand over time to reduce unnecessary waiting while maintaining competitive proximity.

The browser does not create matches directly.

Match creation is a server-owned state transition.

---

# Real Code Execution

Clutch evaluates actual submitted programs.

The current runtime registry supports:

| Language   | Runtime             |
| ---------- | ------------------- |
| Python     | Python 3.12         |
| JavaScript | Node.js             |
| TypeScript | Node.js             |
| C++        | g++ / C++17         |
| Java       | Eclipse Temurin JDK |
| Go         | Go                  |
| Rust       | rustc               |

Available runtimes are exposed through the backend rather than duplicated as a frontend-only language list.

```http
GET /meta/languages
```

This keeps the UI aligned with the actual execution environment.

---

# Execution Pipeline

```text
Source Code
    │
    ▼
Runtime Registry
    │
    ▼
Sandbox
    │
    ├── Compile
    │
    ├── Execute
    │
    ▼
Sandbox Result
    │
    ▼
Test Case Evaluation
    │
    ▼
Submission Result
    │
    ▼
Match Resolution
```

Compiled languages use their native compilation toolchains.

```text
C++   → g++    → executable → run
Java  → javac  → JVM        → run
Go    → build  → executable → run
Rust  → rustc  → executable → run
```

The competitive domain consumes execution results rather than depending directly on compiler implementation details.

This keeps the runtime layer replaceable.

---

# Sandbox

Production-oriented execution uses Docker isolation.

Current controls include resource and environment restrictions such as:

```text
network        disabled
memory         limited
CPU            limited
process count  limited
source size    limited
output size    limited
timeout        enforced
filesystem     restricted
user           non-root
capabilities   dropped
privileges     no-new-privileges
```

Development can use a lighter local execution mode.

Production execution does not rely on that mode.

Docker is treated as a practical isolation boundary rather than a claim of perfect hostile-code security.

Higher-assurance deployments can replace the execution implementation with stronger isolation such as microVM-based runtimes without requiring the competitive domain model to change.

---

# Evaluation

Submission evaluation is asynchronous.

```text
API
 │
 ▼
BullMQ
 │
 ▼
Worker
 │
 ├── Execute Program
 ├── Run Test Cases
 ├── Determine Result
 └── Resolve Match
          │
          ├── Winner
          ├── Rating
          ├── Streak
          ├── Titles
          └── Player Progression
```

Expensive execution work is kept outside the HTTP request lifecycle.

This allows submissions to move through explicit states rather than requiring a single API request to synchronously execute and resolve an entire competitive match.

---

# Ratings and Placement

Clutch uses ELO-based competitive ratings.

Players enter competitive play through placement matches.

```text
Placement
    ↓
Initial Rating State
    ↓
Ranked Matches
    ↓
Rating Updates
```

Competitive rating state includes information such as:

```text
rating
peak rating
placement state
current streak
best streak
season state
final season rank
```

Ratings are scoped to the relevant competitive stack.

Competitive progression should not accidentally treat unrelated stacks as the same rating pool.

---

# Question Bank

Clutch currently contains **111 competitive programming questions** distributed across **9 difficulty bands**.

| Difficulty | Focus                                  |
| ---------- | -------------------------------------- |
| Rookie     | Fundamental programming                |
| Starter    | Core problem solving                   |
| Beginner   | Basic algorithms and data structures   |
| Easy       | Common competitive patterns            |
| Medium     | Algorithmic reasoning                  |
| Hard       | Advanced problem solving               |
| Advanced   | Complex algorithmic systems            |
| Elite      | High-difficulty competitive techniques |
| Clutch     | Expert-level problems                  |

Question coverage includes areas such as:

* Arrays and Lists
* Strings
* Hashing
* Searching
* Sorting
* Stacks and Queues
* Trees
* Graphs
* Dynamic Programming
* Greedy Algorithms
* Math and Number Theory
* Bit Manipulation
* Simulation
* Recursion

Questions contain structured problem definitions, examples, public test cases, hidden test cases, expected output, and stack compatibility.

Competitive question assignment is server-controlled.

Players do not choose the question assigned to a ranked match.

---

# Titles and Progression

Clutch contains **72 persistent competitive titles**.

Titles are evaluated server-side against accumulated competitive facts derived from real match history and player progression.

The title system covers categories such as:

```text
Wins
Matches Played
Unique Problems Solved
Win Streaks
Rating Milestones
First Bloods
Fast Wins
Clean Sweeps
Perfect Executions
Comebacks
Comeback Streaks
Underdog Victories
No-Submit Wins
Difficulty Progression
Stacks Won
Global Rank
```

Titles range from:

```text
common
uncommon
rare
epic
legendary
```

Some achievements are intentionally hidden until unlocked.

Title progression is exposed through the API and rendered dynamically by the frontend.

Awards are protected against duplicates through database-level uniqueness constraints and idempotent evaluation.

```text
Match Resolution
       ↓
Competitive Facts
       ↓
Criteria Evaluation
       ↓
Award Detection
       ↓
Persistent Award
       ↓
Audit Log
       ↓
Player Progression
```

Titles represent recorded competitive achievements.

They are not frontend-only badges.

---

# Seasons

Seasons provide a boundary around competitive progression while preserving historical results.

At rollover:

```text
Active Season
     ↓
Ranked Players
     ↓
Rating Order
     ↓
Final Rank
     ↓
Season Snapshot
     ↓
New Season
```

Historical season results remain available.

New seasons begin new competitive progression cycles without discarding previous competitive state.

---

# Realtime State

Clutch uses WebSockets for live competitive state.

The realtime system communicates events such as:

```text
match.found
match.starting
match.active
match.participant_update
submission.queued
submission.result
match.evaluating
match.resolved
match.snapshot
observer.snapshot
```

The WebSocket layer is a transport mechanism.

It is not the source of truth.

On reconnect, clients can resynchronize against authoritative server state instead of trusting stale browser state.

---

# Spectating

Spectators observe server-owned match state.

```text
Competitive State
       │
       ├── Participant Client
       │
       └── Spectator Client
```

Observers can receive match updates without receiving authority to mutate competitive state.

Spectating is therefore read-only by design.

---

# Competitive Ecosystem

Beyond ranked matchmaking, Clutch includes infrastructure for:

* Player profiles
* Match history
* Rating history
* Friend systems
* Challenges
* Custom rooms
* Events
* Tournaments
* Leaderboards
* Spectating
* Administrative moderation
* Audit logging

These systems share the same underlying principles:

```text
server authority
persistent state
explicit validation
idempotent side effects
observable transitions
```

---

# Authentication and Verification

Competitive actions require authenticated sessions.

Sessions are represented by random tokens that are stored as hashes rather than persisted as plaintext credentials.

Email verification uses:

```text
6-digit OTP
     ↓
Hash
     ↓
Verification Token
     ↓
Attempt Limits
     ↓
Resend Cooldown
     ↓
Single-Use Verification
```

Verification is enforced before entering sensitive competitive flows.

---

# Persistence

PostgreSQL is the persistent source of truth.

The database contains competitive state including:

```text
users
profiles
sessions
verification tokens
matches
participants
submissions
submission runs
ratings
rating ledger
seasons
season snapshots
questions
test cases
titles
user titles
rooms
events
tournaments
audit logs
telemetry
```

Important competitive consequences are persisted rather than reconstructed from frontend presentation state.

---

# Background Processing

The worker handles asynchronous and periodic operations.

This includes:

```text
matchmaking
evaluation
sandbox execution
match resolution
progression evaluation
season lifecycle
```

Moving these responsibilities outside the request/response path keeps expensive work from blocking interactive API operations.

---

# Observability

The API exposes request identifiers and metrics.

A request can be traced through:

```text
Browser
   ↓
API
   ↓
Database / Redis
   ↓
Queue
   ↓
Worker
   ↓
Evaluation
```

Metrics are exposed through:

```http
GET /metrics
```

The objective is to make subsystem failures diagnosable rather than treating the platform as a collection of isolated black boxes.

---

# Testing and Verification

Clutch uses both unit and end-to-end verification.

Current repository verification includes:

```text
307 unit tests
 63 E2E tests
────────────────
370 total tests
```

The E2E environment exercises the real application stack rather than replacing critical boundaries with mocks.

The stack includes:

```text
Fastify
PostgreSQL
Redis
Domain Logic
Matchmaking
BullMQ Worker
Evaluation Pipeline
Sandbox Execution
```

The competitive flow covers paths including:

```text
registration
verification
onboarding
queue entry
matchmaking
match discovery
ready state
competition
submission
evaluation
resolution
rating update
history
reconnection
state synchronization
```

The purpose of the E2E suite is to verify that the competitive system works as a system, not merely that isolated functions return expected values.

---

# Infrastructure

```text
Runtime
  Node.js

Persistence
  PostgreSQL
  Drizzle ORM

Coordination
  Redis
  BullMQ

Execution
  Docker

Build
  pnpm Workspace
  Turborepo
  TypeScript
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

## Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Build Sandbox Images

```bash
pnpm sandbox:build
```

## Run Development Environment

```bash
pnpm dev
```

Or run services individually:

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

Run end-to-end tests:

```bash
pnpm test:e2e
```

---

# Engineering Principles

## Server Authority

Clients request state transitions.

Backend systems validate and decide them.

## Real Execution

Submitted programs are actually executed against test cases.

## Persistent Competitive State

Matches, ratings, titles, history, and progression represent persisted state.

## Idempotent Side Effects

Retries should not produce duplicate competitive consequences.

## Explicit State Machines

Competitive transitions are modeled rather than inferred from frontend state.

## Scoped Competition

Ratings and progression operate within their intended competitive context.

## Asynchronous by Design

Expensive execution and lifecycle processing happen outside latency-sensitive HTTP requests.

## Explicit Trust Boundaries

Security assumptions and infrastructure limitations are documented rather than hidden behind vague guarantees.

## Replaceable Infrastructure

The competitive domain is designed so infrastructure implementations can evolve without rewriting competitive rules.

---

# Known Engineering Boundaries

Clutch is a functional competitive system, but some areas remain deliberate engineering boundaries rather than finished production infrastructure.

### Sandbox Isolation

Docker provides practical isolation and resource controls.

It is not treated as a mathematically perfect hostile-code execution boundary.

Higher-assurance deployments can move toward stronger isolation mechanisms.

### Runtime Performance

Compiled-language cold execution remains an optimization target.

Potential improvements include:

* build caching
* runtime reuse
* compilation optimization
* distributed execution workers

### Editor Experience

The current editor focuses on competitive functionality rather than reproducing a full IDE environment.

A more advanced editor can be added independently of the competitive backend.

### Account Recovery

Verification is implemented.

Broader password and account recovery flows remain separate work.

---

# Project Status

Clutch has moved beyond basic feature implementation.

The current focus is:

```text
system validation
competitive balancing
operational hardening
content expansion
production readiness
```

Implemented systems include:

```text
✓ Authentication
✓ Session Management
✓ Email Verification
✓ Onboarding
✓ Matchmaking
✓ Placement Matches
✓ Server-Authoritative Match Lifecycle
✓ Multi-Language Execution
✓ Docker Sandbox
✓ Asynchronous Evaluation
✓ ELO Ratings
✓ Persistent Streaks
✓ 72 Competitive Titles
✓ 111 Competitive Questions
✓ 9 Difficulty Bands
✓ Seasons
✓ Leaderboards
✓ Spectating
✓ Rooms
✓ Challenges
✓ Events
✓ Tournament Infrastructure
✓ WebSocket State Synchronization
✓ Background Workers
✓ Match History
✓ Rating History
✓ Audit Logging
✓ Observability
✓ End-to-End Competitive Verification
```

---

# Why Clutch Exists

Most coding platforms treat programming as an isolated submission:

```text
write
  ↓
submit
  ↓
accepted / rejected
```

Clutch treats programming competition as a multiplayer systems problem.

```text
player
  ↓
intent
  ↓
server validation
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
progression
  ↓
history
```

Every transition introduces real engineering problems:

```text
race conditions
duplicate requests
stale clients
inconsistent persistence
worker failures
execution isolation
rating integrity
realtime synchronization
authority boundaries
```

Clutch exists to explore those problems as part of one competitive system.

The editor is only one component.

The actual engineering challenge is making the entire chain trustworthy.

**The code is the game.**

And the system should be able to explain how the game happened.

---

## License

See `LICENSE`.
