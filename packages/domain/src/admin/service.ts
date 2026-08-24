import { and, eq, ilike, inArray, sql } from 'drizzle-orm'
import type { Database, DbExecutor } from '@clutch/db'
import { schema } from '@clutch/db'
import { AppError, ErrorCodes } from '@clutch/shared'
import { writeAuditLog } from '../audit.js'
import { competitiveStatusOf } from '../rating/placement.js'
import { appendMatchEvent, getMatchEventsSince } from '../match/events.js'
import { publishMatchEvent } from '../realtime/pubsub.js'

/**
 * Administrator console services.
 *
 * Security model:
 * - Every caller is already authenticated AND permission-checked by the API
 *   layer (requirePermission) before reaching these functions; the functions
 *   additionally re-verify match-scoped state against PostgreSQL.
 * - All DTOs below are explicit whitelists: emails, password material,
 *   session tokens, IP addresses and source code are NEVER selected or
 *   returned. Security metadata requires the separate `admin.security.view`
 *   permission at the route layer.
 * - Observation is strictly read-only; adjudication lives in
 *   match/resolution.ts and reuses the exact-once rating pipeline.
 */

const LIVE_STATUSES = ['matched', 'starting', 'active', 'evaluating'] as const

// ---------------------------------------------------------------------------
// Pure redaction helpers (unit-testable privacy boundaries)
// ---------------------------------------------------------------------------

export type SubmissionLike = {
  id: string
  userId: string
  status: string
  passedCount: number
  totalCount: number
  executionTimeMs: number | null
  isFinal: boolean
  createdAt: Date
}

/**
 * Admin submission view: status/progress only. Source code is deliberately
 * absent from the return type so it cannot leak into responses.
 */
export function redactSubmissionForAdmin(s: SubmissionLike) {
  return {
    id: s.id,
    userId: s.userId,
    status: s.status,
    passedCount: s.passedCount,
    totalCount: s.totalCount,
    executionTimeMs: s.executionTimeMs,
    isFinal: s.isFinal,
    createdAt: s.createdAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Dashboard overview
// ---------------------------------------------------------------------------

export async function getAdminOverview(db: DbExecutor) {
  const [questionCounts] = await db
    .select({
      published: sql<number>`COUNT(*) FILTER (WHERE ${schema.questions.status} = 'published')`,
      drafts: sql<number>`COUNT(*) FILTER (WHERE ${schema.questions.status} = 'draft')`,
      archived: sql<number>`COUNT(*) FILTER (WHERE ${schema.questions.status} = 'retired')`,
    })
    .from(schema.questions)

  const queueRows = await db
    .select({
      stackId: schema.queueEntries.stackId,
      waiting: sql<number>`COUNT(*)`,
    })
    .from(schema.queueEntries)
    .where(eq(schema.queueEntries.status, 'waiting'))
    .groupBy(schema.queueEntries.stackId)

  const [liveCount] = await db
    .select({ live: sql<number>`COUNT(*)` })
    .from(schema.matches)
    .where(inArray(schema.matches.status, [...LIVE_STATUSES]))

  const eventRows = await db.query.events.findMany({
    where: eq(schema.events.status, 'published'),
    columns: { startsAt: true, endsAt: true },
  })
  const now = new Date()
  const activeEvents = eventRows.filter((e) => now >= e.startsAt && now < e.endsAt).length
  const upcomingEvents = eventRows.filter((e) => now < e.startsAt).length

  const [flagCount] = await db
    .select({ open: sql<number>`COUNT(*) FILTER (WHERE ${schema.abuseFlags.status} = 'open')` })
    .from(schema.abuseFlags)

  const liveMatches = await db.query.matches.findMany({
    where: inArray(schema.matches.status, [...LIVE_STATUSES]),
    with: {
      stack: true,
      participants: { with: { user: { with: { profile: true } } } },
    },
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    limit: 10,
  })

  return {
    serverTimeMs: now.getTime(),
    questions: {
      published: Number(questionCounts?.published ?? 0),
      drafts: Number(questionCounts?.drafts ?? 0),
      archived: Number(questionCounts?.archived ?? 0),
    },
    queue: queueRows.map((q) => ({ stackId: q.stackId, waiting: Number(q.waiting) })),
    matches: {
      live: Number(liveCount?.live ?? 0),
      recent: liveMatches.map((m) => ({
        publicId: m.publicId,
        status: m.status,
        stackId: m.stackId,
        difficultyId: m.difficultyId,
        ranked: m.ranked,
        endsAt: m.endsAt?.toISOString() ?? null,
        players: m.participants.map((p) => ({
          handle: p.user.profile?.handle ?? null,
          avatarUrl: p.user.profile?.avatarUrl ?? null,
        })),
      })),
    },
    events: { active: activeEvents, upcoming: upcomingEvents },
    moderation: { pendingFlags: Number(flagCount?.open ?? 0) },
  }
}

// ---------------------------------------------------------------------------
// Match monitoring + inspection
// ---------------------------------------------------------------------------

/** Live matches with per-participant submission state — no source code. */
export async function listAdminMatches(db: Database, limit = 25) {
  const rows = await db.query.matches.findMany({
    where: inArray(schema.matches.status, [...LIVE_STATUSES]),
    with: {
      stack: true,
      questionVersion: { with: { question: true } },
      participants: { with: { user: { with: { profile: true } } } },
    },
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    limit,
  })

  if (rows.length === 0) return []

  const progress = await db
    .select({
      matchId: schema.submissions.matchId,
      userId: schema.submissions.userId,
      bestPassed: sql<number>`MAX(${schema.submissions.passedCount})`,
      attempts: sql<number>`COUNT(*)`,
      evaluating: sql<number>`COUNT(*) FILTER (WHERE ${schema.submissions.status} IN ('queued','running'))`,
    })
    .from(schema.submissions)
    .where(inArray(schema.submissions.matchId, rows.map((r) => r.id)))
    .groupBy(schema.submissions.matchId, schema.submissions.userId)
  const byMatchUser = new Map(progress.map((p) => [`${p.matchId}:${p.userId}`, p]))

  const now = new Date()
  return rows.map((m) => ({
    id: m.id,
    publicId: m.publicId,
    status: m.status,
    phase:
      m.status === 'active' || m.status === 'evaluating'
        ? 'in_duel'
        : ('lobby' as const),
    stackId: m.stackId,
    stackName: m.stack.name,
    difficultyId: m.difficultyId,
    questionTitle: m.questionVersion.question.title,
    ranked: m.ranked,
    timeLimitSec: m.timeLimitSec,
    startedAt: m.startedAt?.toISOString() ?? null,
    endsAt: m.endsAt?.toISOString() ?? null,
    remainingSec:
      m.endsAt !== null ? Math.max(0, Math.round((m.endsAt.getTime() - now.getTime()) / 1000)) : null,
    serverTimeMs: now.getTime(),
    participants: m.participants.map((p) => {
      const prog = byMatchUser.get(`${m.id}:${p.userId}`)
      return {
        handle: p.user.profile?.handle ?? null,
        avatarUrl: p.user.profile?.avatarUrl ?? null,
        ratingBefore: p.ratingBefore,
        submissionState: prog
          ? Number(prog.evaluating) > 0
            ? 'evaluating'
            : 'submitted'
          : ('none' as const),
        passedCount: Number(prog?.bestPassed ?? 0),
        attempts: Number(prog?.attempts ?? 0),
      }
    }),
  }))
}

/** Full inspection view for a single match. Read-only, code-free. */
export async function inspectMatch(db: Database, matchId: string) {
  const m = await db.query.matches.findFirst({
    where: eq(schema.matches.id, matchId),
    with: {
      stack: true,
      season: true,
      questionVersion: { with: { question: true } },
      participants: { with: { user: { with: { profile: true } } } },
    },
  })
  if (!m) throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404)

  const submissions = await db.query.submissions.findMany({
    where: eq(schema.submissions.matchId, m.id),
    orderBy: (s, { asc }) => [asc(s.createdAt)],
  })

  const ratings = await db.query.userStackRatings.findMany({
    where: and(
      inArray(
        schema.userStackRatings.userId,
        m.participants.map((p) => p.userId),
      ),
      eq(schema.userStackRatings.stackId, m.stackId),
    ),
  })

  const events = await getMatchEventsSince(db, m.id)

  // REDACTION: submissions are passed through the whitelist helper — source
  // code can never reach the admin response.
  const now = new Date()
  return {
    id: m.id,
    publicId: m.publicId,
    status: m.status,
    resolutionLabel:
      m.resolveReason === 'adjudicated'
        ? ('admin_adjudication' as const)
        : m.resolveReason === 'forfeit'
          ? ('forfeit' as const)
          : m.resolveReason === 'draw'
            ? ('draw' as const)
            : ('automatic' as const),
    stackName: m.stack.name,
    difficultyId: m.difficultyId,
    questionTitle: m.questionVersion.question.title,
    seasonNumber: m.season.number,
    ranked: m.ranked,
    timeLimitSec: m.timeLimitSec,
    startedAt: m.startedAt?.toISOString() ?? null,
    endsAt: m.endsAt?.toISOString() ?? null,
    resolvedAt: m.resolvedAt?.toISOString() ?? null,
    winnerUserId: m.winnerUserId,
    remainingSec:
      m.endsAt !== null ? Math.max(0, Math.round((m.endsAt.getTime() - now.getTime()) / 1000)) : null,
    serverTimeMs: now.getTime(),
    participants: m.participants.map((p) => {
      const rating = ratings.find((r) => r.userId === p.userId)
      return {
        userId: p.userId,
        handle: p.user.profile?.handle ?? null,
        avatarUrl: p.user.profile?.avatarUrl ?? null,
        slot: p.slot,
        readyAt: p.readyAt?.toISOString() ?? null,
        ratingBefore: p.ratingBefore,
        ratingAfter: p.ratingAfter,
        tierId: rating?.tierId ?? null,
        // Current competitive state of the participant in this stack — lets
        // moderators distinguish ranked / placement / unranked matches.
        competitiveStatus: rating ? competitiveStatusOf(rating.placementRemaining) : null,
        placementRemaining: rating?.placementRemaining ?? null,
        result: p.result,
        submissions: submissions
          .filter((s) => s.userId === p.userId)
          .map(redactSubmissionForAdmin),
      }
    }),
    events: events.map((e) => ({
      id: e.id,
      type: e.eventType,
      actorUserId: e.actorUserId,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}

// ---------------------------------------------------------------------------
// Observer mode (read-only; never a participant)
// ---------------------------------------------------------------------------

async function loadLiveMatchOrThrow(db: DbExecutor, matchId: string) {
  const match = await db.query.matches.findFirst({ where: eq(schema.matches.id, matchId) })
  if (!match) throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404)
  if (!(LIVE_STATUSES as readonly string[]).includes(match.status)) {
    throw new AppError(ErrorCodes.MATCH_NOT_ACTIVE, 'Match is not observable', 409)
  }
  return match
}

/**
 * Server-generated observer lifecycle. The admin NEVER becomes a participant:
 * no participant row, no slot, no effect on matchmaking/ELO/timer. Only the
 * backend can emit these events — clients cannot forge admin.joined/admin.left.
 */
export async function joinMatchAsObserver(
  db: Database,
  redis: import('ioredis').Redis,
  matchId: string,
  admin: { userId: string; handle: string | null },
) {
  const match = await loadLiveMatchOrThrow(db, matchId)

  // Idempotent: joining twice does not duplicate the system event.
  if (await hasActiveObservation(db, matchId, admin.userId)) {
    return { observing: true, alreadyObserving: true }
  }

  await db.transaction(async (tx) => {
    await appendMatchEvent(tx, {
      matchId: match.id,
      eventType: 'admin.joined',
      actorUserId: admin.userId,
      payload: { handle: admin.handle }, // sanitized: handle only, nothing private
    })
    await writeAuditLog(tx, {
      actorUserId: admin.userId,
      action: 'admin.match.join',
      resourceType: 'match',
      resourceId: match.publicId,
      metadata: {},
    })
  })

  // Broadcast AFTER commit so participants only see committed state.
  await publishMatchEvent(redis, match.id, {
    type: 'admin.joined',
    actorUserId: admin.userId,
    payload: { handle: admin.handle },
  })

  return { observing: true, alreadyObserving: false }
}

export async function leaveMatchObservation(
  db: Database,
  redis: import('ioredis').Redis,
  matchId: string,
  admin: { userId: string; handle: string | null },
) {
  const match = await db.query.matches.findFirst({ where: eq(schema.matches.id, matchId) })
  if (!match) throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404)

  if (!(await hasActiveObservation(db, matchId, admin.userId))) {
    return { observing: false }
  }

  await db.transaction(async (tx) => {
    await appendMatchEvent(tx, {
      matchId: match.id,
      eventType: 'admin.left',
      actorUserId: admin.userId,
      payload: { handle: admin.handle },
    })
    await writeAuditLog(tx, {
      actorUserId: admin.userId,
      action: 'admin.match.leave',
      resourceType: 'match',
      resourceId: match.publicId,
      metadata: {},
    })
  })

  await publishMatchEvent(redis, match.id, {
    type: 'admin.left',
    actorUserId: admin.userId,
    payload: { handle: admin.handle },
  })

  return { observing: false }
}

/**
 * Server-side observation state: the admin's most recent observation event for
 * this match must be an un-closed join. Used to authorize WS observer
 * subscriptions without trusting any client claim.
 */
export async function hasActiveObservation(
  db: DbExecutor,
  matchId: string,
  adminUserId: string,
): Promise<boolean> {
  const events = await db.query.matchEvents.findMany({
    where: and(
      eq(schema.matchEvents.matchId, matchId),
      eq(schema.matchEvents.actorUserId, adminUserId),
      inArray(schema.matchEvents.eventType, ['admin.joined', 'admin.left']),
    ),
    orderBy: (e, { desc }) => [desc(e.id)],
    limit: 1,
  })
  return events[0]?.eventType === 'admin.joined'
}

// ---------------------------------------------------------------------------
// User management (privacy-tiered)
// ---------------------------------------------------------------------------

export async function listAdminUsers(db: Database, query?: string, limit = 50) {
  const profiles = await db.query.userProfiles.findMany({
    ...(query
      ? { where: ilike(schema.userProfiles.handle, `%${query}%`) }
      : {}),
    with: { user: true },
    orderBy: (p, { asc }) => [asc(p.handle)],
    limit,
  })

  const userIds = profiles.map((p) => p.userId)
  const ratings = userIds.length
    ? await db.query.userStackRatings.findMany({
        where: inArray(schema.userStackRatings.userId, userIds),
      })
    : []

  return profiles.map((p) => {
    const userRatings = ratings.filter((r) => r.userId === p.userId)
    const best = userRatings.reduce<(typeof userRatings)[number] | null>(
      (top, r) => (!top || r.rating > top.rating ? r : top),
      null,
    )
    // NO email, NO IP, NO session data — baseline admin visibility.
    return {
      userId: p.userId,
      handle: p.handle,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      role: p.user.role,
      status: p.user.status,
      createdAt: p.createdAt.toISOString(),
      bestRating: best?.rating ?? null,
      tierId: best?.tierId ?? null,
      wins: userRatings.reduce((n, r) => n + r.wins, 0),
      losses: userRatings.reduce((n, r) => n + r.losses, 0),
      draws: userRatings.reduce((n, r) => n + r.draws, 0),
      gamesPlayed: userRatings.reduce((n, r) => n + r.gamesPlayed, 0),
      peakRating: userRatings.reduce((m, r) => Math.max(m, r.peakRating), 0),
    }
  })
}

/**
 * Detailed user inspection. Security-sensitive fields (recent session IPs)
 * are returned ONLY when the caller holds `admin.security.view` — the route
 * passes that decision in explicitly; it is never inferred here.
 */
export async function inspectAdminUser(
  db: Database,
  userId: string,
  opts: { includeSecurity: boolean },
) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
    with: { user: true, equippedTitle: true },
  })
  if (!profile) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404)

  const ratings = await db.query.userStackRatings.findMany({
    where: eq(schema.userStackRatings.userId, userId),
    with: { stack: true, tier: true },
  })

  const base = {
    userId: profile.userId,
    handle: profile.handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    region: profile.region,
    role: profile.user.role,
    status: profile.user.status,
    emailVerified: profile.user.emailVerifiedAt !== null,
    memberSince: profile.createdAt.toISOString(),
    equippedTitle: profile.equippedTitle
      ? { code: profile.equippedTitle.code, name: profile.equippedTitle.name }
      : null,
    // Email is PII: shown only with security clearance, like IPs/sessions.
    email: opts.includeSecurity ? profile.user.email : undefined,
    ratings: ratings.map((r) => ({
      stackId: r.stackId,
      rating: r.rating,
      tierId: r.tierId,
      gamesPlayed: r.gamesPlayed,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      peakRating: r.peakRating,
    })),
  }

  if (!opts.includeSecurity) return base

  // Security view: last 10 sessions, IP + agent only, tokens are HASHED at
  // rest and never selectable anyway.
  const sessions = await db.query.authSessions.findMany({
    where: eq(schema.authSessions.userId, userId),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
    limit: 10,
    columns: { ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
  })
  return {
    ...base,
    security: {
      recentSessions: sessions.map((s) => ({
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    },
  }
}

const ACCOUNT_STATUSES = ['active', 'suspended', 'banned'] as const

export async function setUserStatus(
  db: Database,
  adminUserId: string,
  userId: string,
  status: (typeof ACCOUNT_STATUSES)[number],
) {
  if (!ACCOUNT_STATUSES.includes(status)) {
    throw new AppError(ErrorCodes.VALIDATION, 'Invalid account status', 400)
  }
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, userId) })
  if (!target) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404)

  // Guardrail: administrators cannot moderate themselves or other admins.
  if (target.role !== 'user') {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Cannot moderate an administrator account', 403)
  }

  const [updated] = await db
    .update(schema.users)
    .set({ status })
    .where(eq(schema.users.id, userId))
    .returning()

  // Active sessions die with the account status change.
  if (status !== 'active') {
    await db.delete(schema.authSessions).where(eq(schema.authSessions.userId, userId))
  }

  await writeAuditLog(db, {
    actorUserId: adminUserId,
    action: 'admin.user.moderate',
    resourceType: 'user',
    resourceId: userId,
    metadata: { status, previousStatus: target.status },
  })

  return updated
}

// ---------------------------------------------------------------------------
// Audit log (append-only; there is intentionally NO delete/update API)
// ---------------------------------------------------------------------------

export async function listAuditLog(
  db: Database,
  opts: { action?: string; adminUserId?: string; limit: number; offset: number },
) {
  const conditions = [
    opts.action ? eq(schema.auditLog.action, opts.action) : undefined,
    opts.adminUserId ? eq(schema.auditLog.actorUserId, opts.adminUserId) : undefined,
  ].filter(Boolean)

  const entries = await db.query.auditLog.findMany({
    ...(conditions.length > 0 ? { where: and(...conditions) } : {}),
    orderBy: (a, { desc }) => [desc(a.id)],
    limit: opts.limit,
    offset: opts.offset,
  })

  const adminIds = [...new Set(entries.map((e) => e.actorUserId).filter((v): v is string => v !== null))]
  const admins = adminIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(schema.userProfiles.userId, adminIds),
        columns: { userId: true, handle: true },
      })
    : []
  const handleByUser = new Map(admins.map((a) => [a.userId, a.handle]))

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    actorHandle: e.actorUserId ? (handleByUser.get(e.actorUserId) ?? null) : null,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
  }))
}

// ---------------------------------------------------------------------------
// Moderation queue (abuse flags)
// ---------------------------------------------------------------------------

export async function listAbuseFlags(db: Database, status = 'open', limit = 50) {
  const rows = await db.query.abuseFlags.findMany({
    ...(status === 'all' ? {} : { where: eq(schema.abuseFlags.status, status as 'open' | 'reviewed' | 'actioned' | 'dismissed') }),
    orderBy: (f, { desc }) => [desc(f.createdAt)],
    limit,
  })

  const userIds = [...new Set(rows.flatMap((r) => [r.userId]))]
  const profiles = userIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(schema.userProfiles.userId, userIds),
        columns: { userId: true, handle: true },
      })
    : []
  const handleByUser = new Map(profiles.map((p) => [p.userId, p.handle]))

  return rows.map((f) => ({
    id: f.id,
    flagType: f.flagType,
    severity: f.severity,
    status: f.status,
    matchPublicRef: f.matchId,
    userHandle: handleByUser.get(f.userId) ?? null,
    createdAt: f.createdAt.toISOString(),
    evidenceSummary: typeof f.evidence === 'object' && f.evidence !== null && 'similarity' in f.evidence
      ? { similarity: (f.evidence as { similarity?: number }).similarity ?? null }
      : {},
  }))
}

export async function reviewAbuseFlag(
  db: Database,
  adminUserId: string,
  flagId: string,
  decision: 'reviewed' | 'actioned' | 'dismissed',
) {
  const flag = await db.query.abuseFlags.findFirst({ where: eq(schema.abuseFlags.id, flagId) })
  if (!flag) throw new AppError(ErrorCodes.NOT_FOUND, 'Flag not found', 404)

  const [updated] = await db
    .update(schema.abuseFlags)
    .set({ status: decision })
    .where(eq(schema.abuseFlags.id, flagId))
    .returning()

  await writeAuditLog(db, {
    actorUserId: adminUserId,
    action: 'admin.moderation.review',
    resourceType: 'abuse_flag',
    resourceId: flagId,
    metadata: { decision, previousStatus: flag.status },
  })

  return updated
}
