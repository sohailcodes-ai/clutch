import { and, eq, lt } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import { DEFAULT_RATING, PLACEMENT_MATCHES, SEASON_SOFT_RESET_FACTOR } from '@clutch/shared'

export async function rolloverSeason(db: Database) {
  return db.transaction(async (tx) => {
    const active = await tx.query.seasons.findFirst({ where: eq(schema.seasons.status, 'active') })
    if (!active) return null

    // Guard against concurrent rollovers: only one caller archives the season.
    const archived = await tx
      .update(schema.seasons)
      .set({ status: 'archived' })
      .where(and(eq(schema.seasons.id, active.id), eq(schema.seasons.status, 'active')))
      .returning({ id: schema.seasons.id })
    if (archived.length === 0) return null

    const ratings = await tx.query.userStackRatings.findMany()

    // Compute final ranks: only ranked players (placementRemaining === 0) get a rank.
    const ranked = ratings
      .filter((r) => r.placementRemaining === 0)
      .sort((a, b) => b.rating - a.rating)
    const rankMap = new Map<string, number>()
    ranked.forEach((r, i) => rankMap.set(`${r.userId}:${r.stackId}`, i + 1))

    for (const row of ratings) {
      const finalRank = rankMap.get(`${row.userId}:${row.stackId}`) ?? null
      const resetRating = Math.floor(row.rating * SEASON_SOFT_RESET_FACTOR) + 200
      await tx.insert(schema.seasonRatingSnapshots).values({
        seasonId: active.id,
        userId: row.userId,
        stackId: row.stackId,
        startRating: row.rating,
        endRating: row.rating,
        peakRating: row.peakRating,
        gamesPlayed: row.gamesPlayed,
        finalRank,
      })

      await tx
        .update(schema.userStackRatings)
        .set({
          rating: resetRating,
          peakRating: resetRating,
          currentWinStreak: 0,
          bestWinStreak: 0,
          placementRemaining: PLACEMENT_MATCHES,
          updatedAt: new Date(),
        })
        .where(eq(schema.userStackRatings.id, row.id))
    }

    const nextNumber = active.number + 1
    const startsAt = new Date()
    const endsAt = new Date(startsAt)
    endsAt.setDate(endsAt.getDate() + 90)

    const [next] = await tx
      .insert(schema.seasons)
      .values({
        number: nextNumber,
        name: `Season ${String(nextNumber).padStart(2, '0')}`,
        title: 'New Season',
        startsAt,
        endsAt,
        status: 'active',
      })
      .returning()

    return next ?? null
  })
}

export async function applyRatingDecay(db: Database, decayAfterDays: number) {
  const cutoff = new Date(Date.now() - decayAfterDays * 24 * 60 * 60 * 1000)
  const stale = await db.query.userStackRatings.findMany({
    where: lt(schema.userStackRatings.lastPlayedAt, cutoff),
  })

  for (const row of stale) {
    const decayed = Math.max(DEFAULT_RATING, row.rating - 25)
    if (decayed !== row.rating) {
      await db
        .update(schema.userStackRatings)
        .set({ rating: decayed, updatedAt: new Date() })
        .where(eq(schema.userStackRatings.id, row.id))
    }
  }
}
