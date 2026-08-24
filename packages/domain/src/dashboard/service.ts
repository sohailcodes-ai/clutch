import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import {
  sanitizeRecentMatch,
  type PlayerCard,
  type RecentMatchCard,
} from '@clutch/shared'
import { getUserRatings } from '../profile/service.js'

const FINISHED_STATUSES = ['resolved', 'draw', 'abandoned'] as const

/**
 * Player dashboard aggregation. Every value is derived server-side from the
 * authoritative rating system; DTOs are built through explicit sanitizers so
 * private fields (email, sessions, security data, source code) cannot leak.
 */

export async function getPlayerCard(db: Database, userId: string): Promise<PlayerCard | null> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
    with: { user: true, equippedTitle: true },
  })
  if (!profile || profile.user.status !== 'active') return null

  const ratings = await getUserRatings(db, userId)

  const totals = ratings.reduce(
    (acc, r) => ({
      wins: acc.wins + r.wins,
      losses: acc.losses + r.losses,
      draws: acc.draws + r.draws,
      gamesPlayed: acc.gamesPlayed + r.gamesPlayed,
    }),
    { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 },
  )

  const best = ratings.reduce<typeof ratings[number] | null>(
    (top, r) => (!top || r.rating > top.rating ? r : top),
    null,
  )
  const peakRating = ratings.reduce((m, r) => Math.max(m, r.peakRating), 0)

  // Global rank from the authoritative rating system: position of the
  // player's best stack rating among all players' best stack ratings.
  const globalRank = await computeGlobalRank(db, userId)

  const games = totals.gamesPlayed
  const decided = totals.wins + totals.losses

  return {
    handle: profile.handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    equippedTitle: profile.equippedTitle
      ? {
          code: profile.equippedTitle.code,
          name: profile.equippedTitle.name,
          rarity: profile.equippedTitle.rarity,
        }
      : null,
    bestRating: best?.rating ?? 1000,
    bestStackId: best?.stackId ?? null,
    tierId: best?.tierId ?? null,
    globalRank,
    wins: totals.wins,
    losses: totals.losses,
    draws: totals.draws,
    gamesPlayed: games,
    peakRating,
    winRate: decided > 0 ? totals.wins / decided : 0,
  }
}

export async function computeGlobalRank(
  db: Database,
  userId: string,
): Promise<number | null> {
  const mine = await db.query.userStackRatings.findMany({
    where: eq(schema.userStackRatings.userId, userId),
    columns: { rating: true },
  })
  if (mine.length === 0) return null
  const myBest = Math.max(...mine.map((r) => r.rating))

  const betterRows = await db
    .select({ uid: schema.userStackRatings.userId })
    .from(schema.userStackRatings)
    .groupBy(schema.userStackRatings.userId)
    .having(sql`MAX(${schema.userStackRatings.rating}) > ${myBest}`)
  return betterRows.length + 1
}

/**
 * Sanitized recent matches: opponent identity (handle/avatar only), result,
 * rating delta from the ledger, stack/difficulty, duration, time. No source
 * code, no hidden tests, no moderation data.
 */
export async function getRecentMatches(
  db: Database,
  userId: string,
  limit = 10,
): Promise<RecentMatchCard[]> {
  const participants = await db.query.matchParticipants.findMany({
    where: eq(schema.matchParticipants.userId, userId),
    with: {
      match: { with: { participants: true, stack: true } },
    },
  })

  const finished = participants
    .filter((p) => FINISHED_STATUSES.includes(p.match.status as (typeof FINISHED_STATUSES)[number]))
    .sort((a, b) => {
      const at = (a.match.resolvedAt ?? a.match.createdAt).getTime()
      const bt = (b.match.resolvedAt ?? b.match.createdAt).getTime()
      return bt - at
    })
    .slice(0, limit)

  if (finished.length === 0) return []

  const matchIds = finished.map((p) => p.match.id)
  const ledger = await db.query.ratingLedger.findMany({
    where: and(eq(schema.ratingLedger.userId, userId), inArray(schema.ratingLedger.matchId, matchIds)),
  })
  const ledgerByMatch = new Map(ledger.map((l) => [l.matchId, l]))

  const opponentUserIds = finished.flatMap((p) =>
    p.match.participants.filter((x) => x.userId !== userId).map((x) => x.userId),
  )
  const opponentProfiles = opponentUserIds.length
    ? await db.query.userProfiles.findMany({ where: inArray(schema.userProfiles.userId, opponentUserIds) })
    : []
  const profileByUser = new Map(opponentProfiles.map((p) => [p.userId, p]))

  return finished.map((p) => {
    const m = p.match
    const opponentParticipant = m.participants.find((x) => x.userId !== userId)
    const oppProfile = opponentParticipant ? profileByUser.get(opponentParticipant.userId) : undefined
    const startedAt = m.startedAt ?? m.createdAt
    const endAt = m.resolvedAt ?? m.endsAt
    const durationSec = startEndDuration(startedAt, endAt)

    // Unranked room matches have no ledger row — delta stays null.
    const delta = ledgerByMatch.get(m.id)?.ratingDelta ?? null

    return sanitizeRecentMatch({
      matchPublicId: m.publicId,
      opponentHandle: oppProfile?.handle ?? null,
      opponentAvatarUrl: oppProfile?.avatarUrl ?? null,
      result:
        m.status === 'draw' && !m.winnerUserId
          ? 'draw'
          : p.result === 'win' || p.result === 'loss' || p.result === 'draw' || p.result === 'forfeit' || p.result === 'no_result'
            ? p.result
            : 'no_result',
      ratingDelta: delta,
      stackId: m.stackId,
      difficultyId: m.difficultyId,
      durationSec,
      resolvedAt: m.resolvedAt ?? null,
      ranked: m.ranked,
    })
  })
}

function startEndDuration(
  start: Date | null,
  end: Date | null,
): number | null {
  if (!start || !end) return null
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000))
}

/** Full dashboard payload for the authenticated player's home page. */
export async function getDashboard(db: Database, userId: string) {
  const card = await getPlayerCard(db, userId)
  if (!card) return null
  const recentMatches = await getRecentMatches(db, userId, 8)
  const ratings = await getUserRatings(db, userId)
  return {
    playerCard: card,
    recentMatches,
    ratings: ratings.map((r) => ({
      stackId: r.stackId,
      rating: r.rating,
      tierId: r.tierId,
      gamesPlayed: r.gamesPlayed,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      peakRating: r.peakRating,
      placementRemaining: r.placementRemaining,
    })),
    serverTimeMs: Date.now(),
  }
}
