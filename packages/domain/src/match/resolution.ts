import { and, desc, eq } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import type { DbExecutor, Database, Transaction } from '@clutch/db'
import { schema } from '@clutch/db'
import { AppError, ErrorCodes, SIMILARITY_LIMITS } from '@clutch/shared'
import { calculateRatingDelta, resolveTierId, scoreFromResult } from '../rating/elo.js'
import { appendMatchEvent } from '../match/events.js'
import { publishUserEvent, publishMatchEvent } from '../realtime/pubsub.js'
import { createAbuseFlag, writeAuditLog } from '../audit.js'

type ParticipantResult = {
  userId: string
  slot: number
  ratingBefore: number
  passedCount: number
  totalWeight: number
  executionTimeMs: number
  firstAcceptedAt?: Date
  /** Status of the participant's latest FINAL submission (null = none). Used
   *  to detect infrastructure failures that must not consume placement. */
  finalSubmissionStatus: string | null
  result: 'win' | 'loss' | 'draw' | 'forfeit' | 'no_result'
}

type ResolvedMatch = typeof schema.matches.$inferSelect

function compareParticipants(a: ParticipantResult, b: ParticipantResult) {
  if (a.passedCount !== b.passedCount) return a.passedCount > b.passedCount ? a : b
  if (a.executionTimeMs !== b.executionTimeMs) {
    return a.executionTimeMs < b.executionTimeMs ? a : b
  }
  if (a.firstAcceptedAt && b.firstAcceptedAt) {
    return a.firstAcceptedAt < b.firstAcceptedAt ? a : b
  }
  return null
}

async function collectResults(
  tx: DbExecutor,
  matchId: string,
  questionVersionId: string,
  participants: readonly { userId: string; slot: number; ratingBefore: number }[],
): Promise<ParticipantResult[]> {
  const results: ParticipantResult[] = []
  const tests = await tx.query.testCases.findMany({
    where: eq(schema.testCases.questionVersionId, questionVersionId),
  })
  const totalWeight = tests.reduce((sum, t) => sum + t.weight, 0)

  for (const p of participants) {
    const submission = await tx.query.submissions.findFirst({
      where: and(
        eq(schema.submissions.matchId, matchId),
        eq(schema.submissions.userId, p.userId),
      ),
      orderBy: desc(schema.submissions.createdAt),
    })
    const finalSubmission = await tx.query.submissions.findFirst({
      where: and(
        eq(schema.submissions.matchId, matchId),
        eq(schema.submissions.userId, p.userId),
        eq(schema.submissions.isFinal, true),
      ),
      orderBy: desc(schema.submissions.createdAt),
    })

    results.push({
      userId: p.userId,
      slot: p.slot,
      ratingBefore: p.ratingBefore,
      passedCount: submission?.passedCount ?? 0,
      totalWeight,
      executionTimeMs: submission?.executionTimeMs ?? Number.MAX_SAFE_INTEGER,
      firstAcceptedAt: submission?.status === 'accepted' ? submission.createdAt : undefined,
      finalSubmissionStatus: finalSubmission?.status ?? null,
      result: 'no_result',
    })
  }
  return results
}

// ---------------------------------------------------------------------------
// PLACEMENT / RATING INTEGRITY GUARDS (pure, unit-testable)
// ---------------------------------------------------------------------------

/** The evaluator could not judge this submission — an infrastructure failure,
 *  never a competitive signal. */
export function isEvaluationFailure(status: string | null | undefined): boolean {
  return status === 'internal_error'
}

/**
 * Decides whether a judged outcome must be voided into a NO-RESULT match.
 * A match only consumes placement progress / rating when at least one
 * evaluated final submission exists AND neither side failed on
 * infrastructure. Duplicate resolutions can never reach this point at all:
 * the version-guarded transition absorbs them before any rating work runs.
 */
export function shouldVoidCompetitiveOutcome(
  results: readonly { finalSubmissionStatus: string | null }[],
): boolean {
  const anyEvaluated = results.some((r) => r.finalSubmissionStatus !== null)
  if (!anyEvaluated) return true // abandoned/timeout with nothing judged
  return results.some((r) => isEvaluationFailure(r.finalSubmissionStatus))
}

/**
 * Atomically applies ELO updates, participant results and ledger entries for a
 * judged outcome. Runs entirely inside the caller's transaction so ratings,
 * ledger rows and match state commit or roll back together.
 */
async function applyJudgedOutcome(
  tx: Transaction,
  match: Pick<
    typeof schema.matches.$inferSelect,
    'id' | 'stackId' | 'seasonId' | 'ranked'
  >,
  results: [ParticipantResult, ParticipantResult],
): Promise<void> {
  const [a, b] = results
  const scoreA = scoreFromResult(a.result)
  const scoreB = scoreFromResult(b.result)

  for (const current of [a, b]) {
    const opponent = current.userId === a.userId ? b : a
    const actualScore = current.userId === a.userId ? scoreA : scoreB

    // Unranked matches (custom rooms) record outcomes but NEVER touch ELO.
    if (!match.ranked) {
      await tx
        .update(schema.matchParticipants)
        .set({ result: current.result, ratingAfter: null })
        .where(
          and(
            eq(schema.matchParticipants.matchId, match.id),
            eq(schema.matchParticipants.userId, current.userId),
          ),
        )
      continue
    }

    const ratingRow = await tx.query.userStackRatings.findFirst({
      where: and(
        eq(schema.userStackRatings.userId, current.userId),
        eq(schema.userStackRatings.stackId, match.stackId),
      ),
    })
    if (!ratingRow) continue

    const calc = calculateRatingDelta(
      ratingRow.rating,
      opponent.ratingBefore,
      actualScore,
      ratingRow.gamesPlayed,
      ratingRow.placementRemaining,
    )

    const tierId = await resolveTierId(tx, calc.after)
    const wins = ratingRow.wins + (current.result === 'win' ? 1 : 0)
    const losses = ratingRow.losses + (current.result === 'loss' ? 1 : 0)
    const draws = ratingRow.draws + (current.result === 'draw' ? 1 : 0)

    await tx
      .update(schema.userStackRatings)
      .set({
        rating: calc.after,
        tierId,
        gamesPlayed: ratingRow.gamesPlayed + 1,
        wins,
        losses,
        draws,
        placementRemaining: Math.max(0, ratingRow.placementRemaining - 1),
        peakRating: Math.max(ratingRow.peakRating, calc.after),
        lastPlayedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.userStackRatings.id, ratingRow.id))

    await tx
      .update(schema.matchParticipants)
      .set({ result: current.result, ratingAfter: calc.after })
      .where(
        and(
          eq(schema.matchParticipants.matchId, match.id),
          eq(schema.matchParticipants.userId, current.userId),
        ),
      )

    await tx.insert(schema.ratingLedger).values({
      userId: current.userId,
      stackId: match.stackId,
      matchId: match.id,
      seasonId: match.seasonId,
      ratingBefore: ratingRow.rating,
      ratingDelta: calc.delta,
      ratingAfter: calc.after,
      kFactor: calc.k,
      expectedScore: String(calc.expected),
      actualScore: String(actualScore),
    })
  }
}

/**
 * Authoritative match resolution.
 *
 * Exactly-once guarantees:
 * - The terminal state transition is guarded by an optimistic version check;
 *   if another resolver committed first, the update affects zero rows and we
 *   return the already-resolved match without touching ratings again.
 * - Rating updates, participant results and ledger entries happen inside the
 *   same transaction as the state transition.
 * - Realtime events are published strictly AFTER the transaction commits, so
 *   subscribers never observe uncommitted competitive state.
 */
export async function resolveMatch(
  db: Database,
  redis: Redis,
  matchId: string,
): Promise<ResolvedMatch | null> {
  const existing = await db.query.matches.findFirst({
    where: eq(schema.matches.id, matchId),
    with: { participants: true },
  })
  if (!existing) return null
  // Idempotent: an already-resolved/drawn match is returned untouched.
  if (['resolved', 'draw', 'cancelled'].includes(existing.status)) return existing
  if (!['evaluating', 'abandoned', 'active'].includes(existing.status)) return null

  let outcome:
    | { kind: 'judged'; results: [ParticipantResult, ParticipantResult]; winnerUserId: string | null }
    | { kind: 'forfeit'; winnerUserId: string }
    | { kind: 'no_result' }
    | null

  if (existing.status === 'abandoned' && existing.winnerUserId) {
    outcome = { kind: 'forfeit', winnerUserId: existing.winnerUserId }
  } else {
    const ordered = [...existing.participants].sort((x, y) => x.slot - y.slot)
    if (ordered.length !== 2 || !ordered[0] || !ordered[1]) return null
    const results = await collectResults(db, matchId, existing.questionVersionId, [
      ordered[0],
      ordered[1],
    ])

    // Evaluation failure / nothing judged → the match is finalized as a
    // NO-RESULT: no ELO movement, no placement consumption for anyone.
    if (shouldVoidCompetitiveOutcome(results)) {
      outcome = { kind: 'no_result' }
    } else {
      const better = compareParticipants(results[0]!, results[1]!)
      if (better) {
        better.result = 'win'
        const other = results.find((r) => r.userId !== better.userId)
        if (other) other.result = 'loss'
        outcome = {
          kind: 'judged',
          results: results as [ParticipantResult, ParticipantResult],
          winnerUserId: better.userId,
        }
      } else {
        results[0]!.result = 'draw'
        results[1]!.result = 'draw'
        outcome = {
          kind: 'judged',
          results: results as [ParticipantResult, ParticipantResult],
          winnerUserId: null,
        }
      }
    }
  }

  const committed = await db.transaction(async (tx): Promise<boolean> => {
    const status =
      outcome.kind === 'forfeit'
        ? 'resolved'
        : outcome.kind === 'no_result'
          ? 'resolved'
          : outcome.winnerUserId
            ? 'resolved'
            : 'draw'

    const updated = await tx
      .update(schema.matches)
      .set({
        status,
        winnerUserId: outcome.kind === 'no_result' ? null : outcome.winnerUserId,
        resolveReason:
          outcome.kind === 'forfeit'
            ? 'forfeit'
            : outcome.kind === 'no_result'
              ? 'no_result'
              : outcome.winnerUserId
                ? 'judged'
                : 'draw',
        resolvedAt: new Date(),
        version: existing.version + 1,
      })
      .where(and(eq(schema.matches.id, matchId), eq(schema.matches.version, existing.version)))
      .returning({ id: schema.matches.id })

    // Zero rows => a concurrent resolver won the version race. Do nothing.
    if (updated.length === 0) return false

    if (outcome.kind === 'judged') {
      await applyJudgedOutcome(tx, existing, outcome.results)
    } else if (outcome.kind === 'forfeit') {
      const winner = existing.participants.find((p) => p.userId === outcome.winnerUserId)
      const loser = existing.participants.find((p) => p.userId !== outcome.winnerUserId)
      if (winner && loser) {
        await applyJudgedOutcome(
          tx,
          existing,
          [
            { ...winner, passedCount: 1, totalWeight: 1, executionTimeMs: 0, firstAcceptedAt: undefined, finalSubmissionStatus: null, result: 'win' },
            { ...loser, passedCount: 0, totalWeight: 1, executionTimeMs: Number.MAX_SAFE_INTEGER, firstAcceptedAt: undefined, finalSubmissionStatus: null, result: 'loss' },
          ],
        )
      }
    } else {
      // NO-RESULT: participants are marked without any competitive effect.
      await tx.update(schema.matchParticipants).set({ result: 'no_result', ratingAfter: null })
        .where(eq(schema.matchParticipants.matchId, matchId))
    }

    await appendMatchEvent(tx, {
      matchId,
      eventType: 'match.resolved',
      payload: {
        winnerUserId: outcome.kind === 'no_result' ? null : outcome.winnerUserId,
        resolveReason:
          outcome.kind === 'forfeit'
            ? 'forfeit'
            : outcome.kind === 'no_result'
              ? 'no_result'
              : outcome.kind === 'judged' && !outcome.winnerUserId
                ? 'draw'
                : 'judged',
      },
    })

    return true
  })

  // Re-read authoritative post-commit state regardless of which resolver won.
  const final =
    (await db.query.matches.findFirst({ where: eq(schema.matches.id, matchId) })) ?? null

  if (committed && final) {
    for (const p of existing.participants) {
      await publishUserEvent(redis, p.userId, {
        type: 'match.resolved',
        matchId,
        payload: {
          winnerUserId: final.winnerUserId,
          resolveReason: final.resolveReason,
          status: final.status,
        },
      })
    }
  }

  return final
}

export function normalizedShingles(code: string): string[] {
  const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const n = normalize(code).slice(0, SIMILARITY_LIMITS.MAX_NORMALIZED_CHARS)
  const k = SIMILARITY_LIMITS.SHINGLE_SIZE
  const shingles: string[] = []
  for (let i = 0; i + k <= n.length; i += SIMILARITY_LIMITS.SAMPLE_STRIDE) {
    shingles.push(n.slice(i, i + k))
  }
  return shingles
}

/**
 * Pure bounded similarity score in [0,1]: Jaccard overlap of character-level
 * shingle sets. Inputs are hard-capped so a malicious submission cannot make
 * resolution spend unbounded time or memory.
 */
export function similarityScore(aShingles: string[], bShingles: string[]): number {
  if (aShingles.length === 0 || bShingles.length === 0) return 0
  const setA = new Set(aShingles)
  const setB = new Set(bShingles)
  let intersection = 0
  for (const s of setA) if (setB.has(s)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export async function detectSubmissionSimilarity(db: Database, matchId: string) {
  const subs = await db.query.submissions.findMany({
    where: eq(schema.submissions.matchId, matchId),
    orderBy: desc(schema.submissions.createdAt),
    limit: 2,
  })
  if (subs.length < 2) return

  const [a, b] = subs
  if (!a || !b) return

  const similarity = similarityScore(normalizedShingles(a.sourceCode), normalizedShingles(b.sourceCode))
  if (similarity > SIMILARITY_LIMITS.FLAG_THRESHOLD) {
    await createAbuseFlag(db, {
      userId: a.userId,
      matchId,
      flagType: 'similarity',
      severity: 'medium',
      evidence: { similarity, otherUserId: b.userId },
    })
    await createAbuseFlag(db, {
      userId: b.userId,
      matchId,
      flagType: 'similarity',
      severity: 'medium',
      evidence: { similarity, otherUserId: a.userId },
    })
  }
}

// ---------------------------------------------------------------------------
// ADMIN ADJUDICATION
// ---------------------------------------------------------------------------

/** Matches an administrator may override. Terminal states are final. */
const ADJUDICABLE_STATUSES = ['matched', 'starting', 'active', 'evaluating', 'abandoned'] as const

export type AdjudicationInput = { matchId: string; winnerUserId: string; reason: string }

export type AdjudicationCandidate = {
  status: string
  participants: readonly { userId: string }[]
}

/**
 * Pure validation for administrative overrides — unit-testable and
 * deterministic. Enforces: a substantive reason, a winner that is one of the
 * EXACT two participants, and a non-terminal adjudicable state (which also
 * makes duplicate adjudication impossible).
 */
export function validateAdjudication(
  candidate: AdjudicationCandidate,
  input: AdjudicationInput,
): { ok: true } | { ok: false; code: string; message: string } {
  const reason = input.reason.trim()
  if (reason.length < 10 || reason.length > 1000) {
    return { ok: false, code: 'VALIDATION', message: 'A substantive reason is required' }
  }
  const participantIds = candidate.participants.map((p) => p.userId)
  if (participantIds.length !== 2) {
    return { ok: false, code: 'CONFLICT', message: 'Match does not have exactly two participants' }
  }
  if (!participantIds.includes(input.winnerUserId)) {
    return { ok: false, code: 'VALIDATION', message: 'Winner must be a participant of this match' }
  }
  if (!(ADJUDICABLE_STATUSES as readonly string[]).includes(candidate.status)) {
    return { ok: false, code: 'CONFLICT', message: 'Match is not in an adjudicable state' }
  }
  return { ok: true }
}

/**
 * Administrative result override.
 *
 * Reuses the SAME exactly-once machinery as automatic resolution:
 * - optimistic version-guarded terminal transition (duplicate adjudications
 *   and races with the normal resolver are rejected/absorbed safely),
 * - `applyJudgedOutcome` performs the ELO/rating-ledger/participant updates
 *   under the established competitive rules (including the ranked flag),
 * - audit record + match events are written inside the same transaction,
 * - realtime publication happens strictly after commit.
 *
 * The override is distinguishable forever via `resolveReason = 'adjudicated'`.
 */
export async function adjudicateMatch(
  db: Database,
  redis: Redis,
  input: AdjudicationInput & { adminUserId: string },
): Promise<ResolvedMatch> {
  const existing = await db.query.matches.findFirst({
    where: eq(schema.matches.id, input.matchId),
    with: { participants: true },
  })
  if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404)

  // Authorization (permission) is enforced at the API layer; this service
  // re-verifies all match-scoped invariants server-side.
  const check = validateAdjudication(existing, input)
  if (!check.ok) {
    throw new AppError(check.code, check.message, check.code === 'CONFLICT' ? 409 : 400)
  }

  const loser = existing.participants.find((p) => p.userId !== input.winnerUserId)
  if (!loser) throw new AppError(ErrorCodes.CONFLICT, 'Loser could not be determined', 409)

  const totalWeight =
    (
      await db.query.testCases.findMany({
        where: eq(schema.testCases.questionVersionId, existing.questionVersionId),
      })
    ).reduce((sum, t) => sum + t.weight, 0) || 1

  const winnerResult: ParticipantResult = {
    userId: input.winnerUserId,
    slot: existing.participants.find((p) => p.userId === input.winnerUserId)?.slot ?? 1,
    ratingBefore:
      existing.participants.find((p) => p.userId === input.winnerUserId)?.ratingBefore ?? 1000,
    passedCount: totalWeight,
    totalWeight,
    executionTimeMs: 0,
    firstAcceptedAt: undefined,
    finalSubmissionStatus: null,
    result: 'win',
  }
  const loserResult: ParticipantResult = {
    userId: loser.userId,
    slot: loser.slot,
    ratingBefore: loser.ratingBefore,
    passedCount: 0,
    totalWeight,
    executionTimeMs: Number.MAX_SAFE_INTEGER,
    firstAcceptedAt: undefined,
    finalSubmissionStatus: null,
    result: 'loss',
  }

  const committed = await db.transaction(async (tx): Promise<boolean> => {
    const updated = await tx
      .update(schema.matches)
      .set({
        status: 'resolved',
        winnerUserId: input.winnerUserId,
        resolveReason: 'adjudicated',
        resolvedAt: new Date(),
        version: existing.version + 1,
      })
      .where(and(eq(schema.matches.id, existing.id), eq(schema.matches.version, existing.version)))
      .returning({ id: schema.matches.id })

    // Zero rows => concurrently resolved or already adjudicated. Never touch
    // ratings twice.
    if (updated.length === 0) return false

    await applyJudgedOutcome(tx, existing, [winnerResult, loserResult])

    await appendMatchEvent(tx, {
      matchId: existing.id,
      eventType: 'match.adjudicated',
      actorUserId: input.adminUserId,
      payload: {
        winnerUserId: input.winnerUserId,
        reason: input.reason.trim(),
        resolution: 'ADMIN_ADJUDICATION',
      },
    })
    await appendMatchEvent(tx, {
      matchId: existing.id,
      eventType: 'match.resolved',
      payload: { winnerUserId: input.winnerUserId, resolveReason: 'adjudicated' },
    })

    await writeAuditLog(tx, {
      actorUserId: input.adminUserId,
      action: 'admin.match.adjudicate',
      resourceType: 'match',
      resourceId: existing.publicId,
      metadata: {
        winnerUserId: input.winnerUserId,
        loserUserId: loser.userId,
        reason: input.reason.trim(),
        previousStatus: existing.status,
      },
    })

    return true
  })

  const final =
    (await db.query.matches.findFirst({ where: eq(schema.matches.id, existing.id) })) ?? null

  if (committed && final) {
    for (const p of existing.participants) {
      await publishUserEvent(redis, p.userId, {
        type: 'match.resolved',
        matchId: existing.id,
        payload: {
          winnerUserId: final.winnerUserId,
          resolveReason: final.resolveReason,
          status: final.status,
          resolution: 'ADMIN_ADJUDICATION',
        },
      })
    }
    await publishMatchEvent(redis, existing.id, {
      type: 'match.adjudicated',
      actorUserId: input.adminUserId,
      payload: { winnerUserId: final.winnerUserId, resolution: 'ADMIN_ADJUDICATION' },
    })
  }

  if (!final) throw new AppError(ErrorCodes.INTERNAL, 'Failed to re-read adjudicated match', 500)
  return final
}
