import { eq, desc, and, sql, inArray } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'

export interface MatchHistoryEntry {
  matchId: string
  publicId: string
  opponent: {
    handle: string
    displayName: string | null
    avatarUrl: string | null
  } | null
  stackId: string
  result: 'win' | 'loss' | 'draw' | 'forfeit' | null
  ratingBefore: number
  ratingAfter: number
  ratingDelta: number
  startedAt: Date | null
  endedAt: Date | null
  status: string
}

export interface RatingHistoryEntry {
  matchId: string
  publicId: string | null
  stackId: string
  ratingBefore: number
  ratingDelta: number
  ratingAfter: number
  createdAt: Date
}

/**
 * Get match history for a user by handle.
 * Returns public-safe match information only — no source code, hidden tests,
 * or internal telemetry.
 */
export async function getMatchHistory(
  db: Database,
  handle: string,
  limit = 50,
  offset = 0,
): Promise<MatchHistoryEntry[]> {
  // First find the user by handle
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.handle, handle),
  })
  if (!profile) return []

  const userId = profile.userId

  // Get matches where user was a participant
  const participantRows = await db.query.matchParticipants.findMany({
    where: eq(schema.matchParticipants.userId, userId),
    orderBy: desc(schema.matchParticipants.joinedAt),
    limit,
    offset,
    with: {
      match: {
        with: {
          participants: true,
        },
      },
    },
  })

  const results: MatchHistoryEntry[] = []

  for (const p of participantRows) {
    const match = p.match
    if (!match) continue

    // Only include resolved matches in history
    if (match.status !== 'resolved' && match.status !== 'draw') continue

    // Find opponent
    const opponentParticipant = match.participants.find(
      (op) => op.userId !== userId,
    )
    let opponent: MatchHistoryEntry['opponent'] = null
    if (opponentParticipant) {
      const opponentProfile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, opponentParticipant.userId),
      })
      if (opponentProfile) {
        opponent = {
          handle: opponentProfile.handle,
          displayName: opponentProfile.displayName,
          avatarUrl: opponentProfile.avatarUrl,
        }
      }
    }

    const ratingDelta = (p.ratingAfter ?? p.ratingBefore) - p.ratingBefore

    results.push({
      matchId: match.id,
      publicId: match.publicId,
      opponent,
      stackId: match.stackId,
      result: p.result === 'no_result' ? null : p.result,
      ratingBefore: p.ratingBefore,
      ratingAfter: p.ratingAfter ?? p.ratingBefore,
      ratingDelta,
      startedAt: match.startedAt,
      endedAt: match.resolvedAt,
      status: match.status,
    })
  }

  return results
}

/**
 * Get rating history for a user by handle.
 * Returns chronological rating ledger entries suitable for graph rendering.
 */
export async function getRatingHistory(
  db: Database,
  handle: string,
  stackId?: string,
  limit = 100,
): Promise<RatingHistoryEntry[]> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.handle, handle),
  })
  if (!profile) return []

  const userId = profile.userId

  const where = stackId
    ? and(
        eq(schema.ratingLedger.userId, userId),
        eq(schema.ratingLedger.stackId, stackId),
      )
    : eq(schema.ratingLedger.userId, userId)

  const rows = await db.query.ratingLedger.findMany({
    where,
    orderBy: desc(schema.ratingLedger.createdAt),
    limit,
  })

  // Fetch match publicIds separately since ratingLedger doesn't have a relation
  const matchIds = [...new Set(rows.map((r) => r.matchId))]
  const matchPublicIds = new Map<string, string>()
  if (matchIds.length > 0) {
    const matchRows = await db.query.matches.findMany({
      where: inArray(schema.matches.id, matchIds),
      columns: { id: true, publicId: true },
    })
    for (const m of matchRows) {
      matchPublicIds.set(m.id, m.publicId)
    }
  }

  return rows.map((r) => ({
    matchId: r.matchId,
    publicId: matchPublicIds.get(r.matchId) ?? null,
    stackId: r.stackId,
    ratingBefore: r.ratingBefore,
    ratingDelta: r.ratingDelta,
    ratingAfter: r.ratingAfter,
    createdAt: r.createdAt,
  }))
}

/**
 * Get win/loss statistics for a user.
 */
export async function getPlayerStats(db: Database, handle: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.handle, handle),
  })
  if (!profile) return null

  const userId = profile.userId

  const stats = await db.query.matchParticipants.findMany({
    where: eq(schema.matchParticipants.userId, userId),
    columns: {
      result: true,
    },
  })

  const wins = stats.filter((s) => s.result === 'win').length
  const losses = stats.filter((s) => s.result === 'loss').length
  const draws = stats.filter((s) => s.result === 'draw').length
  const forfeits = stats.filter((s) => s.result === 'forfeit').length
  const total = stats.length

  return {
    handle,
    total,
    wins,
    losses,
    draws,
    forfeits,
    winRate: total > 0 ? wins / total : 0,
  }
}
