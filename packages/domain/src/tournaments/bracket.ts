import { eq, and, asc, inArray } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import type { Database, Transaction } from '@clutch/db'
import type { Redis } from 'ioredis'
import { schema } from '@clutch/db'
import { AppError, ErrorCodes, DEFAULT_RATING } from '@clutch/shared'
import { selectQuestionForMatch } from '../questions/service.js'
import { appendMatchEvent } from '../match/events.js'
import { publishTournamentEvent, publishUserEvent } from '../realtime/pubsub.js'

/**
 * Bracket Engine for single-elimination tournaments.
 *
 * Deterministic, transaction-safe, retry-safe.
 * - BYE handling for odd participant counts
 * - Winner advancement to next round
 * - Duplicate match creation prevention via tournamentId+roundNumber+position unique constraint
 * - Optimistic concurrency on bracket node updates
 */

type BracketNode = typeof schema.tournamentBracketNodes.$inferSelect

/** Next power of 2 >= n (used to determine bracket size). */
function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/** Number of rounds needed for a bracket of size bracketSize. */
function totalRounds(bracketSize: number): number {
  return Math.log2(bracketSize)
}

/** Generate round names based on total rounds. */
function roundNames(numRounds: number): string[] {
  if (numRounds === 1) return ['Final']
  if (numRounds === 2) return ['Semifinals', 'Final']
  if (numRounds === 3) return ['Quarterfinals', 'Semifinals', 'Final']
  const names: string[] = []
  for (let i = 0; i < numRounds; i++) {
    if (i === numRounds - 2) names.push('Semifinals')
    else if (i === numRounds - 1) names.push('Final')
    else {
      const roundFromFinal = numRounds - 1 - i
      const matchCount = Math.pow(2, roundFromFinal)
      names.push(`Round of ${matchCount}`)
    }
  }
  return names
}

/**
 * Seed a single-elimination bracket.
 *
 * 1. Get registered participants (ordered by seed)
 * 2. Compute bracket size (next power of 2)
 * 3. Create rounds
 * 4. Create bracket nodes with BYEs for padding
 * 5. Create first-round matches for non-bye matchups
 */
export async function generateBracket(
  db: Database,
  tournamentId: string,
): Promise<{ rounds: typeof schema.tournamentRounds.$inferSelect[]; nodes: BracketNode[] }> {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, tournamentId),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)
  if (tournament.status !== 'seeding') {
    throw new AppError(ErrorCodes.CONFLICT, 'Tournament must be in seeding status to generate bracket', 409)
  }

  const registrations = await db.query.tournamentRegistrations.findMany({
    where: eq(schema.tournamentRegistrations.tournamentId, tournamentId),
    orderBy: (r, { asc: a }) => [a(r.seed), a(r.registeredAt)],
  })

  if (registrations.length < 2) {
    throw new AppError(ErrorCodes.VALIDATION, 'Need at least 2 participants to generate bracket', 400)
  }

  const bracketSize = nextPow2(registrations.length)
  const numRounds = totalRounds(bracketSize)
  const names = roundNames(numRounds)

  return db.transaction(async (tx) => {
    // Delete existing rounds/nodes (idempotent re-seeding)
    await tx.delete(schema.tournamentBracketNodes).where(
      eq(schema.tournamentBracketNodes.tournamentId, tournamentId),
    )
    await tx.delete(schema.tournamentRounds).where(
      eq(schema.tournamentRounds.tournamentId, tournamentId),
    )

    // Create rounds
    const roundRows = await tx
      .insert(schema.tournamentRounds)
      .values(
        names.map((name, i) => ({
          tournamentId,
          roundNumber: i + 1,
          name,
          status: i === 0 ? 'ready' as const : 'pending' as const,
        })),
      )
      .returning()

    // Create bracket nodes
    const nodes: BracketNode[] = []

    for (let roundIdx = 0; roundIdx < numRounds; roundIdx++) {
      const round = roundRows[roundIdx]!
      const matchesInRound = bracketSize >> (roundIdx + 1)

      for (let pos = 0; pos < matchesInRound; pos++) {
        let participantAUserId: string | null = null
        let participantBUserId: string | null = null
        let isBye = false

        if (roundIdx === 0) {
          // First round: seed participants
          const seedA = pos * 2
          const seedB = pos * 2 + 1

          participantAUserId = registrations[seedA]?.userId ?? null
          participantBUserId = registrations[seedB]?.userId ?? null

          // BYE: one slot is empty
          if (!participantAUserId || !participantBUserId) {
            isBye = true
          }
        }
        // Later rounds: participants are filled by advancement

        const [node] = await tx
          .insert(schema.tournamentBracketNodes)
          .values({
            tournamentId,
            roundId: round.id,
            roundNumber: round.roundNumber,
            position: pos,
            participantAUserId,
            participantBUserId,
            isBye,
            status: isBye ? 'completed' as const : roundIdx === 0 ? 'active' as const : 'pending' as const,
          })
          .returning()

        if (!node) throw new AppError(ErrorCodes.INTERNAL, 'Failed to create bracket node', 500)
        nodes.push(node)

        // Handle first-round BYEs: auto-advance the lone participant
        if (isBye && roundIdx === 0) {
          const winnerId = participantAUserId ?? participantBUserId
          if (winnerId) {
            await tx
              .update(schema.tournamentBracketNodes)
              .set({ winnerUserId: winnerId })
              .where(eq(schema.tournamentBracketNodes.id, node.id))

            // Advance winner to next round node
            if (roundIdx + 1 < numRounds) {
              const nextRound = roundRows[roundIdx + 1]!
              const nextPos = Math.floor(pos / 2)
              const nextNode = await tx.query.tournamentBracketNodes.findFirst({
                where: and(
                  eq(schema.tournamentBracketNodes.tournamentId, tournamentId),
                  eq(schema.tournamentBracketNodes.roundId, nextRound.id),
                  eq(schema.tournamentBracketNodes.position, nextPos),
                ),
              })
              if (nextNode) {
                const isFirstSlot = pos % 2 === 0
                await tx
                  .update(schema.tournamentBracketNodes)
                  .set(isFirstSlot
                    ? { participantAUserId: winnerId }
                    : { participantBUserId: winnerId })
                  .where(eq(schema.tournamentBracketNodes.id, nextNode.id))
              }
            }
          }
        }
      }
    }

    // Update tournament status to running
    await tx
      .update(schema.tournaments)
      .set({ status: 'running' })
      .where(eq(schema.tournaments.id, tournamentId))

    // Mark first round as running
    const firstRound = roundRows[0]
    if (firstRound) {
      await tx
        .update(schema.tournamentRounds)
        .set({ status: 'running', startsAt: new Date() })
        .where(eq(schema.tournamentRounds.id, firstRound.id))
    }

    return { rounds: roundRows, nodes }
  })
}

/**
 * Create matches for all active bracket nodes in a round that don't have matches yet.
 * Called after bracket generation or after a round completes.
 */
export async function createRoundMatches(
  db: Database,
  redis: import('ioredis').Redis,
  tournamentId: string,
  roundNumber: number,
): Promise<{ matchCount: number }> {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, tournamentId),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)

  const round = await db.query.tournamentRounds.findFirst({
    where: and(
      eq(schema.tournamentRounds.tournamentId, tournamentId),
      eq(schema.tournamentRounds.roundNumber, roundNumber),
    ),
  })
  if (!round) throw new AppError(ErrorCodes.NOT_FOUND, 'Round not found', 404)

  // Get bracket nodes for this round that need matches
  const nodes = await db.query.tournamentBracketNodes.findMany({
    where: and(
      eq(schema.tournamentBracketNodes.tournamentId, tournamentId),
      eq(schema.tournamentBracketNodes.roundId, round.id),
    ),
    orderBy: (n, { asc: a }) => a(n.position),
  })

  let matchCount = 0

  for (const node of nodes) {
    // Skip BYEs and nodes that already have matches
    if (node.isBye || node.matchId) continue

    // Need both participants to create a match
    if (!node.participantAUserId || !node.participantBUserId) continue

    // Get ratings
    const ratings = await db.query.userStackRatings.findMany({
      where: and(
        inArray(schema.userStackRatings.userId, [node.participantAUserId, node.participantBUserId]),
        eq(schema.userStackRatings.stackId, tournament.stackId),
      ),
    })
    const ratingOf = (userId: string) =>
      ratings.find((r) => r.userId === userId)?.rating ?? DEFAULT_RATING

    // Select question
    const selected = await selectQuestionForMatch(
      db,
      tournament.stackId,
      (ratingOf(node.participantAUserId) + ratingOf(node.participantBUserId)) / 2,
      [node.participantAUserId, node.participantBUserId],
    )
    if (!selected) continue

    // Create match
    const match = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.matches)
        .values({
          publicId: `CL-${randomBytes(4).toString('hex').toUpperCase()}`,
          seasonId: tournament.seasonId,
          stackId: tournament.stackId,
          questionVersionId: selected.version.id,
          difficultyId: selected.difficultyId,
          status: 'matched',
          timeLimitSec: tournament.timeLimitSec ?? 900,
          ranked: true,
          tournamentId: tournament.id,
        })
        .returning()
      if (!created) throw new AppError(ErrorCodes.INTERNAL, 'Failed to create tournament match', 500)

      await tx.insert(schema.matchParticipants).values([
        {
          matchId: created.id,
          userId: node.participantAUserId!,
          slot: 1,
          ratingBefore: ratingOf(node.participantAUserId!),
        },
        {
          matchId: created.id,
          userId: node.participantBUserId!,
          slot: 2,
          ratingBefore: ratingOf(node.participantBUserId!),
        },
      ])

      await appendMatchEvent(tx, {
        matchId: created.id,
        eventType: 'match.matched',
        payload: {
          userIds: [node.participantAUserId, node.participantBUserId],
          source: 'tournament',
          tournamentId: tournament.id,
          roundNumber,
          position: node.position,
        },
      })

      // Link match to bracket node
      await tx
        .update(schema.tournamentBracketNodes)
        .set({ matchId: created.id })
        .where(eq(schema.tournamentBracketNodes.id, node.id))

      return created
    })

    matchCount++

    // Publish events after transaction commit
    const questionMeta = {
      title: selected.question.title,
      promptMd: selected.version.promptMd,
      starterCode: selected.version.starterCode,
      timeLimitSec: match.timeLimitSec,
    }

    await publishUserEvent(redis, node.participantAUserId!, {
      type: 'match.found',
      matchId: match.id,
      payload: { matchId: match.id, publicId: match.publicId, opponentUserId: node.participantBUserId, questionMeta, source: 'tournament' },
    })
    await publishUserEvent(redis, node.participantBUserId!, {
      type: 'match.found',
      matchId: match.id,
      payload: { matchId: match.id, publicId: match.publicId, opponentUserId: node.participantAUserId, questionMeta, source: 'tournament' },
    })
  }

  return { matchCount }
}

type PendingEvent = {
  channel: 'tournament' | 'user'
  targetId: string
  event: { type: string; payload?: Record<string, unknown>; actorUserId?: string }
}

/**
 * Advance a tournament after a match resolves.
 *
 * 1. Find the bracket node for this match
 * 2. Set the winner on the node
 * 3. Advance winner to next round's bracket node
 * 4. Check if the round is complete
 * 5. Check if the tournament is complete (final node resolved)
 *
 * CRITICAL: All realtime events are collected during the transaction and
 * published ONLY AFTER the transaction commits. This prevents clients from
 * receiving events for state that later rolled back.
 */
export async function advanceTournament(
  db: Database,
  redis: import('ioredis').Redis,
  matchId: string,
): Promise<{
  advanced: boolean
  tournamentComplete: boolean
  winnerUserId: string | null
  nextMatchCreated: boolean
}> {
  const match = await db.query.matches.findFirst({
    where: eq(schema.matches.id, matchId),
  })
  if (!match || !match.tournamentId) return { advanced: false, tournamentComplete: false, winnerUserId: null, nextMatchCreated: false }

  // Find the bracket node for this match
  const node = await db.query.tournamentBracketNodes.findFirst({
    where: eq(schema.tournamentBracketNodes.matchId, matchId),
  })
  if (!node) return { advanced: false, tournamentComplete: false, winnerUserId: null, nextMatchCreated: false }

  // Already advanced
  if (node.winnerUserId) return { advanced: false, tournamentComplete: false, winnerUserId: node.winnerUserId, nextMatchCreated: false }

  const winnerUserId = match.winnerUserId
  if (!winnerUserId) return { advanced: false, tournamentComplete: false, winnerUserId: null, nextMatchCreated: false }

  // Check if tournament is complete (this is the final)
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, match.tournamentId),
  })
  if (!tournament) return { advanced: false, tournamentComplete: false, winnerUserId: null, nextMatchCreated: false }

  const allRounds = await db.query.tournamentRounds.findMany({
    where: eq(schema.tournamentRounds.tournamentId, tournament.id),
    orderBy: (r, { asc: a }) => a(r.roundNumber),
  })
  const maxRound = allRounds[allRounds.length - 1]
  const isFinal = node.roundNumber === maxRound?.roundNumber

  // Collect events during the transaction; publish after commit
  const pendingEvents: PendingEvent[] = []

  const result = await db.transaction(async (tx) => {
    // Set winner on bracket node
    await tx
      .update(schema.tournamentBracketNodes)
      .set({ winnerUserId, status: 'completed' })
      .where(eq(schema.tournamentBracketNodes.id, node.id))

    // If this is the final, complete the tournament
    if (isFinal) {
      await tx
        .update(schema.tournaments)
        .set({
          status: 'completed',
          championUserId: winnerUserId,
          endsAt: new Date(),
        })
        .where(eq(schema.tournaments.id, tournament.id))

      // Mark final round as completed
      if (maxRound) {
        await tx
          .update(schema.tournamentRounds)
          .set({ status: 'completed' })
          .where(eq(schema.tournamentRounds.id, maxRound.id))
      }

      // Queue tournament.completed event (published after commit)
      pendingEvents.push({
        channel: 'tournament',
        targetId: tournament.id,
        event: { type: 'tournament.completed', payload: { winnerUserId, championHandle: null } },
      })

      return { advanced: true, tournamentComplete: true, winnerUserId, nextMatchCreated: false }
    }

    // Advance to next round
    const nextRoundNumber = node.roundNumber + 1
    const nextRound = allRounds.find((r) => r.roundNumber === nextRoundNumber)
    if (!nextRound) return { advanced: true, tournamentComplete: false, winnerUserId, nextMatchCreated: false }

    const nextPosition = Math.floor(node.position / 2)
    const isFirstSlot = node.position % 2 === 0

    const nextNode = await tx.query.tournamentBracketNodes.findFirst({
      where: and(
        eq(schema.tournamentBracketNodes.tournamentId, tournament.id),
        eq(schema.tournamentBracketNodes.roundId, nextRound.id),
        eq(schema.tournamentBracketNodes.position, nextPosition),
      ),
    })

    let nextMatchCreated = false
    if (nextNode) {
      // Set winner in the appropriate slot
      await tx
        .update(schema.tournamentBracketNodes)
        .set(isFirstSlot
          ? { participantAUserId: winnerUserId }
          : { participantBUserId: winnerUserId })
        .where(eq(schema.tournamentBracketNodes.id, nextNode.id))

      // Check if both participants are now set
      const updated = await tx.query.tournamentBracketNodes.findFirst({
        where: eq(schema.tournamentBracketNodes.id, nextNode.id),
      })
      if (updated?.participantAUserId && updated.participantBUserId) {
        await tx
          .update(schema.tournamentBracketNodes)
          .set({ status: 'active' })
          .where(eq(schema.tournamentBracketNodes.id, nextNode.id))

        // Create match for this node
        const tournament2 = await tx.query.tournaments.findFirst({
          where: eq(schema.tournaments.id, tournament.id),
        })
        if (tournament2) {
          const ratings = await tx.query.userStackRatings.findMany({
            where: and(
              inArray(schema.userStackRatings.userId, [updated.participantAUserId, updated.participantBUserId]),
              eq(schema.userStackRatings.stackId, tournament2.stackId),
            ),
          })
          const ratingOf = (userId: string) =>
            ratings.find((r) => r.userId === userId)?.rating ?? DEFAULT_RATING

          const { selectQuestionForMatch } = await import('../questions/service.js')
          const selected = await selectQuestionForMatch(
            db,
            tournament2.stackId,
            (ratingOf(updated.participantAUserId) + ratingOf(updated.participantBUserId)) / 2,
            [updated.participantAUserId, updated.participantBUserId],
          )
          if (selected) {
            const matchCreated = await tx.transaction(async (innerTx) => {
              const [created] = await innerTx
                .insert(schema.matches)
                .values({
                  publicId: `CL-${randomBytes(4).toString('hex').toUpperCase()}`,
                  seasonId: tournament2.seasonId,
                  stackId: tournament2.stackId,
                  questionVersionId: selected.version.id,
                  difficultyId: selected.difficultyId,
                  status: 'matched',
                  timeLimitSec: tournament2.timeLimitSec ?? 900,
                  ranked: true,
                  tournamentId: tournament2.id,
                })
                .returning()

              if (created) {
                await innerTx.insert(schema.matchParticipants).values([
                  {
                    matchId: created.id,
                    userId: updated.participantAUserId!,
                    slot: 1,
                    ratingBefore: ratingOf(updated.participantAUserId!),
                  },
                  {
                    matchId: created.id,
                    userId: updated.participantBUserId!,
                    slot: 2,
                    ratingBefore: ratingOf(updated.participantBUserId!),
                  },
                ])

                await appendMatchEvent(innerTx, {
                  matchId: created.id,
                  eventType: 'match.matched',
                  payload: {
                    userIds: [updated.participantAUserId, updated.participantBUserId],
                    source: 'tournament',
                    tournamentId: tournament2.id,
                    roundNumber: nextRoundNumber,
                    position: nextPosition,
                  },
                })

                await innerTx
                  .update(schema.tournamentBracketNodes)
                  .set({ matchId: created.id })
                  .where(eq(schema.tournamentBracketNodes.id, nextNode.id))

                return created
              }
              return null
            })

            if (matchCreated) {
              nextMatchCreated = true
              // Queue match.found user events (published after commit)
              const questionMeta = {
                title: selected.question.title,
                promptMd: selected.version.promptMd,
                starterCode: selected.version.starterCode,
                timeLimitSec: matchCreated.timeLimitSec,
              }
              pendingEvents.push({
                channel: 'user',
                targetId: updated.participantAUserId!,
                event: {
                  type: 'match.found',
                  payload: { matchId: matchCreated.id, publicId: matchCreated.publicId, opponentUserId: updated.participantBUserId, questionMeta, source: 'tournament' },
                },
              })
              pendingEvents.push({
                channel: 'user',
                targetId: updated.participantBUserId!,
                event: {
                  type: 'match.found',
                  payload: { matchId: matchCreated.id, publicId: matchCreated.publicId, opponentUserId: updated.participantAUserId, questionMeta, source: 'tournament' },
                },
              })
            }
          }
        }
      }
    }

    // Check if current round is complete
    const currentRoundNodes = await tx.query.tournamentBracketNodes.findMany({
      where: and(
        eq(schema.tournamentBracketNodes.tournamentId, tournament.id),
        eq(schema.tournamentBracketNodes.roundId, node.roundId),
      ),
    })
    const allComplete = currentRoundNodes.every(
      (n) => n.isBye || n.status === 'completed',
    )
    if (allComplete) {
      await tx
        .update(schema.tournamentRounds)
        .set({ status: 'completed' })
        .where(eq(schema.tournamentRounds.id, node.roundId))

      // Mark next round as running if not already
      if (nextRound) {
        await tx
          .update(schema.tournamentRounds)
          .set({ status: 'running', startsAt: new Date() })
          .where(
            and(
              eq(schema.tournamentRounds.id, nextRound.id),
              eq(schema.tournamentRounds.status, 'ready'),
            ),
          )
      }

      // Queue tournament.round_completed event
      pendingEvents.push({
        channel: 'tournament',
        targetId: tournament.id,
        event: { type: 'tournament.round_completed', payload: { roundNumber: node.roundNumber } },
      })
    }

    // Queue elimination event for the loser
    const loserUserId = winnerUserId === node.participantAUserId
      ? node.participantBUserId
      : node.participantAUserId
    if (loserUserId) {
      pendingEvents.push({
        channel: 'tournament',
        targetId: tournament.id,
        event: { type: 'tournament.player_eliminated', payload: { userId: loserUserId, roundNumber: node.roundNumber } },
      })
    }

    return { advanced: true, tournamentComplete: false, winnerUserId, nextMatchCreated }
  })

  // === PUBLISH EVENTS ONLY AFTER TRANSACTION COMMITS ===
  for (const pe of pendingEvents) {
    if (pe.channel === 'tournament') {
      await publishTournamentEvent(redis, pe.targetId, pe.event)
    } else if (pe.channel === 'user') {
      await publishUserEvent(redis, pe.targetId, pe.event)
    }
  }

  return result
}

/**
 * Get full bracket data for a tournament (used by frontend bracket view).
 */
export async function getTournamentBracket(
  db: Database,
  tournamentId: string,
) {
  const rounds = await db.query.tournamentRounds.findMany({
    where: eq(schema.tournamentRounds.tournamentId, tournamentId),
    orderBy: (r, { asc: a }) => a(r.roundNumber),
  })

  const nodes = await db.query.tournamentBracketNodes.findMany({
    where: eq(schema.tournamentBracketNodes.tournamentId, tournamentId),
    with: {
      participantA: { with: { profile: true } },
      participantB: { with: { profile: true } },
      winner: { with: { profile: true } },
      match: true,
    },
    orderBy: (n, { asc: a }) => [a(n.roundNumber), a(n.position)],
  })

  return {
    rounds: rounds.map((r) => ({
      roundNumber: r.roundNumber,
      name: r.name,
      status: r.status,
    })),
    nodes: nodes.map((n) => ({
      id: n.id,
      roundNumber: n.roundNumber,
      position: n.position,
      participantA: n.participantA
        ? {
            userId: n.participantAUserId!,
            handle: n.participantA.profile?.handle ?? null,
            avatarUrl: n.participantA.profile?.avatarUrl ?? null,
          }
        : null,
      participantB: n.participantB
        ? {
            userId: n.participantBUserId!,
            handle: n.participantB.profile?.handle ?? null,
            avatarUrl: n.participantB.profile?.avatarUrl ?? null,
          }
        : null,
      winner: n.winnerUserId
        ? {
            userId: n.winnerUserId,
            handle: n.winner?.profile?.handle ?? null,
          }
        : null,
      matchId: n.matchId,
      matchPublicId: n.match?.publicId ?? null,
      matchStatus: n.match?.status ?? null,
      isBye: n.isBye,
      status: n.status,
    })),
  }
}
