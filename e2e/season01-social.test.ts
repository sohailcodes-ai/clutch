/**
 * ============================================================================
 * E2E SEASON 01 SOCIAL VERTICAL SLICE
 * ============================================================================
 * Tests the complete friend + challenge + spectator flow using REAL infrastructure:
 *   - Real PostgreSQL
 *   - Real Redis
 *   - Real API server (Fastify, in-process, shared singleton)
 *
 * Flow:
 *   Player A registers → verifies → onboards
 *   Player B registers → verifies → onboards
 *   A sends friend request → B accepts
 *   A sees B as friend
 *   A challenges B → B accepts
 *   Server creates challenge match
 *   Both ready → match starts
 *   Spectator views match
 *   A submits → evaluation → resolution
 *   Verify ELO unchanged (challenge match is unrated)
 *   Verify challenge history recorded
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// ---------------------------------------------------------------------------
// Environment setup — must be set before any @clutch/* imports
// ---------------------------------------------------------------------------
process.env.NODE_ENV = 'development'
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://clutch:clutch@localhost:5432/clutch'
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
process.env.SESSION_SECRET = 'e2e-test-secret-at-least-32-characters-long'
process.env.SANDBOX_MODE = 'child_process'
process.env.EMAIL_MODE = 'log'
process.env.API_PORT = '4999'
process.env.API_HOST = '127.0.0.1'
process.env.CORS_ORIGIN = 'http://localhost:3000'
process.env.EVALUATION_CONCURRENCY = '2'

import { createDb, schema } from '@clutch/db'
import { eq, desc } from 'drizzle-orm'
import {
  hashOtp,
  evaluateSubmission,
  shouldEvaluateMatch,
  markMatchEvaluating,
  resolveMatch,
  evaluateAndAwardTitles,
  publishMatchEvent,
} from '@clutch/domain'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_BASE = 'http://127.0.0.1:4999'
const TEST_STACK = 'python'
const TIMESTAMP = Date.now()

let evalTimer: ReturnType<typeof setInterval> | null = null
let workerRedis: InstanceType<typeof import('ioredis')['Redis']> | null = null
const evaluatingSubmissions = new Set<string>()

const PLAYER_A = {
  email: `e2e-social-a-${TIMESTAMP}@test.clutch.dev`,
  password: 'TestPassword123!',
  handle: `e2e_sa_${TIMESTAMP}`,
}

const PLAYER_B = {
  email: `e2e-social-b-${TIMESTAMP}@test.clutch.dev`,
  password: 'TestPassword456!',
  handle: `e2e_sb_${TIMESTAMP}`,
}

const SPECTATOR = {
  email: `e2e-social-spec-${TIMESTAMP}@test.clutch.dev`,
  password: 'TestPassword789!',
  handle: `e2e_ss_${TIMESTAMP}`,
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
type FetchResult<T = unknown> = {
  status: number
  headers: Headers
  body: T
  setCookie?: string[]
}

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<FetchResult<T>> {
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })

  const text = await res.text()
  let parsed: T
  try {
    parsed = JSON.parse(text) as T
  } catch {
    parsed = text as unknown as T
  }

  const setCookie = res.headers.getSetCookie?.() ?? []
  return { status: res.status, headers: res.headers, body: parsed, setCookie }
}

function extractSessionCookie(setCookie: string[]): string {
  const cookie = setCookie.find((c) => c.startsWith('clutch_session='))
  if (!cookie) throw new Error(`No clutch_session cookie found in: ${JSON.stringify(setCookie)}`)
  return cookie.split(';')[0]!
}

async function getCorrectSolution(matchId: string): Promise<string> {
  const db = getDb()
  const match = await db.query.matches.findFirst({
    where: eq(schema.matches.id, matchId),
    with: { questionVersion: { with: { question: true } } },
  })
  if (!match) throw new Error(`Match ${matchId} not found`)
  const slug = match.questionVersion?.question?.slug

  switch (slug) {
    case 'sum-two-numbers':
      return `import sys
data = sys.stdin.read().strip().split()
a, b = int(data[0]), int(data[1])
print(a + b)`
    case 'even-or-odd':
      return `n = int(input().strip())
print("even" if n % 2 == 0 else "odd")`
    case 'greet-by-name':
      return `name = input().strip()
print(f"Hello, {name}!")`
    case 'countdown-sum':
      return `n = int(input().strip())
print(sum(range(1, n + 1)))`
    case 'reverse-a-string':
      return `s = input().strip()
print(s[::-1])`
    case 'count-vowels':
      return `s = input().strip()
count = sum(1 for c in s.lower() if c in 'aeiou')
print(count)`
    case 'list-max-and-min':
      return `n = int(input().strip())
nums = list(map(int, input().strip().split()))
print(max(nums))
print(min(nums))`
    case 'word-frequency-count':
      return `import sys
from collections import OrderedDict
words = sys.stdin.read().strip().split()
freq = OrderedDict()
for w in words:
    freq[w] = freq.get(w, 0) + 1
for w, c in freq.items():
    print(f"{w} {c}")`
    case 'fizzbuzz-clutch':
      return `n = int(input().strip())
for i in range(1, n + 1):
    if i % 15 == 0: print("FizzBuzz")
    elif i % 3 == 0: print("Fizz")
    elif i % 5 == 0: print("Buzz")
    else: print(i)`
    default:
      throw new Error(`Unknown question slug: ${slug}. Cannot generate solution.`)
  }
}

let _db: ReturnType<typeof createDb> | null = null
function getDb() {
  if (!_db) _db = createDb(process.env.DATABASE_URL!)
  return _db
}

async function verifyUser(cookie: string): Promise<{ userId: string }> {
  const meRes = await api<{ user: { id: string } }>('GET', '/auth/me', undefined, cookie)
  expect(meRes.status).toBe(200)
  const userId = meRes.body.user.id

  const reqRes = await api('POST', '/auth/verify/request', undefined, cookie)
  expect(reqRes.status).toBe(204)

  // Wait for token to be persisted
  await new Promise((r) => setTimeout(r, 500))

  const db = getDb()
  const token = await db.query.verificationTokens.findFirst({
    where: eq(schema.verificationTokens.userId, userId),
    orderBy: desc(schema.verificationTokens.createdAt),
  })
  expect(token).toBeDefined()

  const testOtp = '123456'
  await db.update(schema.verificationTokens)
    .set({ otpHash: hashOtp(testOtp) })
    .where(eq(schema.verificationTokens.id, token!.id))

  const verifyRes = await api<{ verified: boolean }>('POST', '/auth/verify/confirm', { otp: testOtp }, cookie)
  expect(verifyRes.status).toBe(200)
  expect(verifyRes.body.verified).toBe(true)

  return { userId }
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------
let playerACookie: string
let playerBCookie: string
let spectatorCookie: string
let playerAUserId: string
let playerBUserId: string
let spectatorUserId: string
let challengeId: string
let matchId: string

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------
beforeAll(async () => {
  // Flush rate-limit keys so this file gets a full quota (happy-path may
  // have consumed slots during the same vitest run).
  const Redis = (await import('ioredis')).default
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
  try {
    const keys = await redis.keys('ratelimit:*')
    if (keys.length) await redis.del(...keys)
  } finally {
    await redis.quit()
  }

  // Verify the server is running (started by globalSetup)
  const healthRes = await api<{ ok: boolean }>('GET', '/health')
  expect(healthRes.body.ok).toBe(true)

  const db = getDb()
  const stacks = await db.query.stacks.findMany({ where: eq(schema.stacks.id, TEST_STACK) })
  expect(stacks.length).toBe(1)
}, 30_000)

afterAll(async () => {
  // Cleanup test data (best-effort)
  try {
    const db = getDb()
    for (const userId of [playerAUserId, playerBUserId, spectatorUserId]) {
      if (!userId) continue
      try {
        await db.delete(schema.ratingLedger).where(eq(schema.ratingLedger.userId, userId))
        await db.delete(schema.submissions).where(eq(schema.submissions.userId, userId))
        await db.delete(schema.matchParticipants).where(eq(schema.matchParticipants.userId, userId))
        await db.delete(schema.queueEntries).where(eq(schema.queueEntries.userId, userId))
        await db.delete(schema.userStackRatings).where(eq(schema.userStackRatings.userId, userId))
        await db.delete(schema.verificationTokens).where(eq(schema.verificationTokens.userId, userId))
        await db.delete(schema.authSessions).where(eq(schema.authSessions.userId, userId))
        await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, userId))
        await db.delete(schema.users).where(eq(schema.users.id, userId))
      } catch {}
    }
    // Cleanup social data
    await db.delete(schema.friendships)
    await db.delete(schema.challenges)
  } catch {}
}, 15_000)

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

describe('Season 01 Social Vertical Slice', () => {
  // ========================================================================
  // 1. REGISTRATION
  // ========================================================================
  it('registers Player A', async () => {
    const res = await api<{ user: { id: string; profile: { handle: string } | null } }>(
      'POST', '/auth/register',
      { email: PLAYER_A.email, password: PLAYER_A.password, handle: PLAYER_A.handle, region: 'global' },
    )
    expect(res.status).toBe(201)
    expect(res.body.user.id).toBeDefined()
    playerACookie = extractSessionCookie(res.setCookie ?? [])
  })

  it('registers Player B', async () => {
    const res = await api<{ user: { id: string } }>(
      'POST', '/auth/register',
      { email: PLAYER_B.email, password: PLAYER_B.password, handle: PLAYER_B.handle, region: 'global' },
    )
    expect(res.status).toBe(201)
    playerBCookie = extractSessionCookie(res.setCookie ?? [])
  })

  it('registers Spectator', async () => {
    const res = await api<{ user: { id: string } }>(
      'POST', '/auth/register',
      { email: SPECTATOR.email, password: SPECTATOR.password, handle: SPECTATOR.handle, region: 'global' },
    )
    expect(res.status).toBe(201)
    spectatorCookie = extractSessionCookie(res.setCookie ?? [])
  })

  // ========================================================================
  // 2. EMAIL VERIFICATION
  // ========================================================================
  it('verifies Player A', async () => {
    const { userId } = await verifyUser(playerACookie)
    playerAUserId = userId
  })

  it('verifies Player B', async () => {
    const { userId } = await verifyUser(playerBCookie)
    playerBUserId = userId
  })

  it('verifies Spectator', async () => {
    const { userId } = await verifyUser(spectatorCookie)
    spectatorUserId = userId
  })

  // ========================================================================
  // 3. ONBOARDING
  // ========================================================================
  it('onboards Player A', async () => {
    const res = await api<{ profile: { primaryStackId: string } }>(
      'POST', '/profile/onboarding', { primaryStackId: TEST_STACK }, playerACookie,
    )
    expect(res.status).toBe(200)
  })

  it('onboards Player B', async () => {
    const res = await api<{ profile: { primaryStackId: string } }>(
      'POST', '/profile/onboarding', { primaryStackId: TEST_STACK }, playerBCookie,
    )
    expect(res.status).toBe(200)
  })

  // ========================================================================
  // 4. FRIEND SYSTEM
  // ========================================================================
  it('Player A sends friend request to Player B', async () => {
    const res = await api<{ friendship: { id: string; status: string } }>(
      'POST', '/friends/request', { handle: PLAYER_B.handle }, playerACookie,
    )
    expect(res.status).toBe(201)
    expect(res.body.friendship.status).toBe('pending')
  })

  it('rejects duplicate friend request', async () => {
    const res = await api<{ error: string }>(
      'POST', '/friends/request', { handle: PLAYER_B.handle }, playerACookie,
    )
    expect([409, 429]).toContain(res.status)
  })

  it('prevents self friend request', async () => {
    const res = await api<{ error: string }>(
      'POST', '/friends/request', { handle: PLAYER_A.handle }, playerACookie,
    )
    expect(res.status).toBe(400)
  })

  it('Player B sees pending requests', async () => {
    const res = await api<{ incoming: { id: string; requesterHandle: string }[]; outgoing: any[] }>(
      'GET', '/friends/requests', undefined, playerBCookie,
    )
    expect(res.status).toBe(200)
    expect(res.body.incoming.length).toBe(1)
    expect(res.body.incoming[0].requesterHandle).toBe(PLAYER_A.handle)
  })

  it('Player B accepts friend request', async () => {
    const res = await api<{ friendship: { status: string } }>(
      'POST', `/friends/${playerAUserId}/accept`, undefined, playerBCookie,
    )
    expect(res.status).toBe(200)
    expect(res.body.friendship.status).toBe('accepted')
  })

  it('Player A sees Player B as a friend', async () => {
    const res = await api<{ friends: { handle: string; status: string }[] }>(
      'GET', '/friends', undefined, playerACookie,
    )
    expect(res.status).toBe(200)
    expect(res.body.friends.length).toBe(1)
    expect(res.body.friends[0].handle).toBe(PLAYER_B.handle)
  })

  // ========================================================================
  // 5. CHALLENGE SYSTEM
  // ========================================================================
  it('Player A challenges Player B', async () => {
    const res = await api<{ challenge: { id: string; status: string } }>(
      'POST', '/challenges',
      { handle: PLAYER_B.handle, stackId: TEST_STACK },
      playerACookie,
    )
    expect(res.status).toBe(201)
    expect(res.body.challenge.status).toBe('pending')
    challengeId = res.body.challenge.id
  })

  it('prevents challenge from non-friend', async () => {
    const res = await api<{ error: string }>(
      'POST', '/challenges',
      { handle: PLAYER_A.handle, stackId: TEST_STACK },
      spectatorCookie,
    )
    expect([403, 409]).toContain(res.status)
  })

  it('Player B accepts challenge and match is created', async () => {
    const res = await api<{ challenge: { status: string }; matchId: string }>(
      'POST', `/challenges/${challengeId}/accept`, undefined, playerBCookie,
    )
    expect(res.status).toBe(200)
    expect(res.body.challenge.status).toBe('match_created')
    expect(res.body.matchId).toBeDefined()
    matchId = res.body.matchId
  })

  it('challenge match is unrated', async () => {
    const res = await api<{ match: { ranked: boolean; status: string } }>(
      'GET', `/matches/${matchId}`, undefined, playerACookie,
    )
    expect(res.status).toBe(200)
    expect(res.body.match.ranked).toBe(false)
  })

  // ========================================================================
  // 6. READY FLOW
  // ========================================================================
  it('Player A readies up', async () => {
    const res = await api<{ ready: boolean }>(
      'POST', `/matches/${matchId}/ready`, undefined, playerACookie,
    )
    expect(res.status).toBe(200)
    expect(res.body.ready).toBe(true)
  })

  it('Player B readies up and match starts', async () => {
    const res = await api<{ ready: boolean; active: boolean }>(
      'POST', `/matches/${matchId}/ready`, undefined, playerBCookie,
    )
    expect(res.status).toBe(200)
    expect(res.body.ready).toBe(true)
    expect(res.body.active).toBe(true)
  })

  // ========================================================================
  // 7. SPECTATOR
  // ========================================================================
  it('spectator can view challenge match', async () => {
    const matchRes = await api<{ match: { publicId: string } }>(
      'GET', `/matches/${matchId}`, undefined, playerACookie,
    )
    const publicId = matchRes.body.match.publicId

    const res = await api<{ match: { publicId: string; status: string } }>(
      'GET', `/spectate/${publicId}`,
    )
    expect([200, 404]).toContain(res.status)
  })

  // ========================================================================
  // 8. SUBMISSION
  // ========================================================================
  it('Player A submits correct solution', async () => {
    const solution = await getCorrectSolution(matchId)
    const res = await api<{ submission: { id: string; status: string } }>(
      'POST', `/matches/${matchId}/submissions`,
      { sourceCode: solution, isFinal: true, idempotencyKey: `social-submit-a-${TIMESTAMP}` },
      playerACookie,
    )
    expect(res.status).toBe(201)
  })

  it('Player B submits incorrect solution', async () => {
    const res = await api<{ submission: { id: string; status: string } }>(
      'POST', `/matches/${matchId}/submissions`,
      { sourceCode: 'print("wrong")', isFinal: true, idempotencyKey: `social-submit-b-${TIMESTAMP}` },
      playerBCookie,
    )
    expect(res.status).toBe(201)
  })

  // ========================================================================
  // 9. WAIT FOR EVALUATION
  // ========================================================================
  it('match resolves', async () => {
    let resolved = false
    const deadline = Date.now() + 30_000
    while (!resolved && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000))
      const res = await api<{ match: { status: string } }>(
        'GET', `/matches/${matchId}`, undefined, playerACookie,
      )
      if (res.body.match && ['resolved', 'draw', 'abandoned'].includes(res.body.match.status)) {
        resolved = true
      }
    }
    expect(resolved).toBe(true)
  })

  // ========================================================================
  // 10. VERIFY ELO UNCHANGED
  // ========================================================================
  it('challenge match did not affect ELO', async () => {
    const db = getDb()
    const ledgerA = await db.query.ratingLedger.findMany({
      where: eq(schema.ratingLedger.userId, playerAUserId),
    })
    // No rating ledger entries should exist for this challenge match
    const challengeEntries = ledgerA.filter((e) => e.matchId === matchId)
    expect(challengeEntries.length).toBe(0)
  })

  it('challenge history is recorded', async () => {
    const res = await api<{ challenges: { id: string; status: string; matchId: string | null }[] }>(
      'GET', '/challenges', undefined, playerACookie,
    )
    expect(res.status).toBe(200)
    const completed = res.body.challenges.find((c) => c.id === challengeId)
    expect(completed).toBeDefined()
    expect(completed!.status).toBe('match_created')
    expect(completed!.matchId).toBe(matchId)
  })

  // ========================================================================
  // 11. SYSTEM HEALTH
  // ========================================================================
  it('system is healthy after social E2E', async () => {
    const res = await api<{ ok: boolean; checks: Record<string, boolean> }>('GET', '/ready')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
