import { eq, and, or, desc, lte } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { schema } from '@clutch/db'
import type { Database } from '@clutch/db'
import { AppError, ErrorCodes, CHALLENGE_EXPIRY_SEC } from '@clutch/shared'
import { publishUserEvent, publishMatchEvent } from '../realtime/pubsub.js'
import { areFriends } from '../friends/service.js'
import { selectQuestionForMatch } from '../questions/service.js'
import { getCurrentSeason, listStacks } from '../profile/service.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChallengeRow = typeof schema.challenges.$inferSelect

export type ChallengeView = {
  id: string
  challenger: { userId: string; handle: string; displayName: string | null }
  challenged: { userId: string; handle: string; displayName: string | null }
  status: string
  stackId: string
  difficultyId: string | null
  createdAt: Date
  expiresAt: Date
  matchId: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePublicId(): string {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `CL-${hex}`
}

async function hydrateChallenge(
  db: Database,
  row: ChallengeRow,
): Promise<ChallengeView> {
  const [challengerProfile, challengedProfile] = await Promise.all([
    db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, row.challengerId),
    }),
    db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, row.challengedId),
    }),
  ])
  return {
    id: row.id,
    challenger: {
      userId: row.challengerId,
      handle: challengerProfile?.handle ?? 'unknown',
      displayName: challengerProfile?.displayName ?? null,
    },
    challenged: {
      userId: row.challengedId,
      handle: challengedProfile?.handle ?? 'unknown',
      displayName: challengedProfile?.displayName ?? null,
    },
    status: row.status,
    stackId: row.stackId,
    difficultyId: row.difficultyId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    matchId: row.matchId,
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Send a challenge to a friend.
 * Must be friends; cannot challenge self; challenger must not have too many
 * outgoing pending challenges.
 */
export async function sendChallenge(
  db: Database,
  redis: Redis,
  challengerId: string,
  input: { handle: string; stackId: string; difficultyId?: string },
): Promise<ChallengeView> {
  const target = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.handle, input.handle),
  })
  if (!target) throw new AppError(ErrorCodes.NOT_FOUND, 'Player not found', 404)
  if (target.userId === challengerId) {
    throw new AppError(ErrorCodes.SELF_ACTION, 'Cannot challenge yourself', 400)
  }

  // Must be friends
  const friends = await areFriends(db, challengerId, target.userId)
  if (!friends) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Can only challenge friends', 403)
  }

  // Validate stack exists
  const stacks = await listStacks(db)
  const validStack = stacks.find((s) => s.id === input.stackId && s.isActive)
  if (!validStack) {
    throw new AppError(ErrorCodes.VALIDATION, 'Invalid stack', 400)
  }

  // Check max outgoing pending challenges
  const outgoingPending = await db.query.challenges.findMany({
    where: and(
      eq(schema.challenges.challengerId, challengerId),
      eq(schema.challenges.status, 'pending'),
    ),
  })
  if (outgoingPending.length >= 5) {
    throw new AppError(ErrorCodes.TOO_MANY_REQUESTS, 'Too many outgoing challenges', 429)
  }

  // Check if target already has a pending challenge accepted (incompatibility)
  const targetAccepted = await db.query.challenges.findFirst({
    where: and(
      eq(schema.challenges.challengedId, target.userId),
      eq(schema.challenges.status, 'accepted'),
    ),
  })
  if (targetAccepted) {
    throw new AppError(ErrorCodes.CHALLENGE_CONFLICT, 'Player already has an accepted challenge', 409)
  }

  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_SEC * 1000)

  const [created] = await db
    .insert(schema.challenges)
    .values({
      challengerId,
      challengedId: target.userId,
      status: 'pending',
      stackId: input.stackId,
      difficultyId: input.difficultyId ?? null,
      expiresAt,
    })
    .returning()

  const view = await hydrateChallenge(db, created)

  // Notify challenged player
  await publishUserEvent(redis, target.userId, {
    type: 'challenge.received',
    payload: {
      challengeId: created.id,
      challenger: view.challenger,
      stackId: view.stackId,
      expiresAt: view.expiresAt.toISOString(),
    },
  })

  return view
}

/**
 * Accept a pending challenge. Creates a private unrated match.
 */
export async function acceptChallenge(
  db: Database,
  redis: Redis,
  challengedUserId: string,
  challengeId: string,
): Promise<{ challenge: ChallengeView; matchId: string }> {
  const challenge = await db.query.challenges.findFirst({
    where: eq(schema.challenges.id, challengeId),
  })
  if (!challenge) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Challenge not found', 404)
  }
  if (challenge.challengedId !== challengedUserId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Not authorized', 403)
  }
  if (challenge.status !== 'pending') {
    throw new AppError(ErrorCodes.CHALLENGE_INVALID, 'Challenge is not pending', 409)
  }
  if (new Date() > challenge.expiresAt) {
    // Auto-expire
    await db
      .update(schema.challenges)
      .set({ status: 'expired' })
      .where(eq(schema.challenges.id, challenge.id))
    throw new AppError(ErrorCodes.CHALLENGE_EXPIRED, 'Challenge has expired', 410)
  }

  const season = await getCurrentSeason(db)
  if (!season) throw new AppError(ErrorCodes.CONFLICT, 'No active season', 409)

  // Get current ratings for both players
  const challengerRating = await db.query.userStackRatings.findFirst({
    where: and(
      eq(schema.userStackRatings.userId, challenge.challengerId),
      eq(schema.userStackRatings.stackId, challenge.stackId),
    ),
  })
  const challengedRating = await db.query.userStackRatings.findFirst({
    where: and(
      eq(schema.userStackRatings.userId, challenge.challengedId),
      eq(schema.userStackRatings.stackId, challenge.stackId),
    ),
  })

  const challengerRatingVal = challengerRating?.rating ?? 1000
  const challengedRatingVal = challengedRating?.rating ?? 1000
  const avgRating = (challengerRatingVal + challengedRatingVal) / 2

  // Select question
  const selection = await selectQuestionForMatch(
    db,
    challenge.stackId,
    avgRating,
    [challenge.challengerId, challenge.challengedId],
    { preferredDifficultyId: challenge.difficultyId ?? undefined },
  )
  if (!selection) {
    throw new AppError(ErrorCodes.INTERNAL, 'No question available', 500)
  }

  // Create the match
  const publicId = generatePublicId()
  const questionVersion = await db.query.questionVersions.findFirst({
    where: eq(schema.questionVersions.id, selection.version.id),
  })
  const timeLimitSec = 900

  const [match] = await db
    .insert(schema.matches)
    .values({
      publicId,
      seasonId: season.id,
      stackId: challenge.stackId,
      questionVersionId: selection.version.id,
      difficultyId: selection.difficultyId,
      status: 'matched',
      timeLimitSec,
      ranked: false, // Challenge matches are UNRATED
    })
    .returning()

  // Add participants
  await db.insert(schema.matchParticipants).values([
    {
      matchId: match.id,
      userId: challenge.challengerId,
      slot: 1,
      ratingBefore: challengerRatingVal,
    },
    {
      matchId: match.id,
      userId: challenge.challengedId,
      slot: 2,
      ratingBefore: challengedRatingVal,
    },
  ])

  // Update challenge status
  await db
    .update(schema.challenges)
    .set({ status: 'match_created', matchId: match.id, acceptedAt: new Date() })
    .where(eq(schema.challenges.id, challenge.id))

  const updatedChallenge = await db.query.challenges.findFirst({
    where: eq(schema.challenges.id, challenge.id),
  })
  const view = await hydrateChallenge(db, updatedChallenge!)

  // Notify both players
  for (const uid of [challenge.challengerId, challenge.challengedId]) {
    await publishUserEvent(redis, uid, {
      type: 'challenge.match_created',
      payload: {
        challengeId: challenge.id,
        matchId: match.id,
        publicId,
      },
    })
  }

  return { challenge: view, matchId: match.id }
}

/**
 * Decline a pending challenge.
 */
export async function declineChallenge(
  db: Database,
  redis: Redis,
  challengedUserId: string,
  challengeId: string,
): Promise<ChallengeView> {
  const challenge = await db.query.challenges.findFirst({
    where: eq(schema.challenges.id, challengeId),
  })
  if (!challenge) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Challenge not found', 404)
  }
  if (challenge.challengedId !== challengedUserId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Not authorized', 403)
  }
  if (challenge.status !== 'pending') {
    throw new AppError(ErrorCodes.CHALLENGE_INVALID, 'Challenge is not pending', 409)
  }

  const [updated] = await db
    .update(schema.challenges)
    .set({ status: 'declined' })
    .where(eq(schema.challenges.id, challenge.id))
    .returning()

  const view = await hydrateChallenge(db, updated)

  // Notify challenger
  await publishUserEvent(redis, challenge.challengerId, {
    type: 'challenge.declined',
    payload: { challengeId },
  })

  return view
}

/**
 * Cancel a pending challenge (challenger can cancel).
 */
export async function cancelChallenge(
  db: Database,
  redis: Redis,
  challengerId: string,
  challengeId: string,
): Promise<ChallengeView> {
  const challenge = await db.query.challenges.findFirst({
    where: eq(schema.challenges.id, challengeId),
  })
  if (!challenge) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Challenge not found', 404)
  }
  if (challenge.challengerId !== challengerId) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Not authorized', 403)
  }
  if (challenge.status !== 'pending') {
    throw new AppError(ErrorCodes.CHALLENGE_INVALID, 'Challenge is not pending', 409)
  }

  const [updated] = await db
    .update(schema.challenges)
    .set({ status: 'cancelled' })
    .where(eq(schema.challenges.id, challenge.id))
    .returning()

  const view = await hydrateChallenge(db, updated)

  // Notify challenged player
  await publishUserEvent(redis, challenge.challengedId, {
    type: 'challenge.cancelled',
    payload: { challengeId },
  })

  return view
}

/**
 * List challenges for a user.
 */
export async function listChallenges(
  db: Database,
  userId: string,
  opts: { status?: string; limit?: number; offset?: number } = {},
): Promise<ChallengeView[]> {
  const limit = opts.limit ?? 20
  const offset = opts.offset ?? 0

  const conditions = [
    or(
      eq(schema.challenges.challengerId, userId),
      eq(schema.challenges.challengedId, userId),
    ),
  ]
  if (opts.status) {
    conditions.push(eq(schema.challenges.status, opts.status as any))
  }

  const rows = await db.query.challenges.findMany({
    where: and(...conditions),
    orderBy: desc(schema.challenges.createdAt),
    limit,
    offset,
  })

  return Promise.all(rows.map((r) => hydrateChallenge(db, r)))
}

/**
 * Sweep expired challenges (call periodically).
 */
export async function expirePendingChallenges(
  db: Database,
  redis: Redis,
): Promise<number> {
  const expired = await db
    .update(schema.challenges)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.challenges.status, 'pending'),
        lte(schema.challenges.expiresAt, new Date()),
      ),
    )
    .returning()

  // Notify affected users
  for (const row of expired) {
    await publishUserEvent(redis, row.challengedId, {
      type: 'challenge.expired',
      payload: { challengeId: row.id },
    })
    await publishUserEvent(redis, row.challengerId, {
      type: 'challenge.expired',
      payload: { challengeId: row.id },
    })
  }

  return expired.length
}
