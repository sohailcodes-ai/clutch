import { eq } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import {
  AppError,
  ErrorCodes,
  type UpdateProfileInput,
  type CompleteOnboardingInput,
} from '@clutch/shared'
import { getUserAwards } from '../titles/service.js'
import { buildCompetitiveIdentity, competitiveStatusOf, placementMatchesCompleted } from '../rating/placement.js'
import { writeAuditLog } from '../audit.js'

export async function updateProfile(db: Database, userId: string, input: UpdateProfileInput) {
  if (input.handle) {
    const taken = await db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.handle, input.handle),
    })
    if (taken && taken.userId !== userId) {
      throw new AppError(ErrorCodes.CONFLICT, 'Handle already taken', 409)
    }
  }

  const [profile] = await db
    .update(schema.userProfiles)
    .set({
      ...(input.handle ? { handle: input.handle } : {}),
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.region ? { region: input.region } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.userProfiles.userId, userId))
    .returning()

  await writeAuditLog(db, {
    actorUserId: userId,
    action: 'profile.update',
    resourceType: 'user_profile',
    resourceId: userId,
    metadata: input,
  })

  return profile
}

export async function getUserRatings(db: Database, userId: string) {
  return db.query.userStackRatings.findMany({
    where: eq(schema.userStackRatings.userId, userId),
    with: { stack: true, tier: true },
  })
}

/**
 * Sanitized per-stack competitive row for SELF endpoints. Tier is withheld
 * while the player is unranked; placement progress is derived from the
 * authoritative remaining count (never gamesPlayed).
 */
export function toSelfRatingView(row: {
  stackId: string
  rating: number
  tierId: string | null
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  peakRating: number
  placementRemaining: number
}) {
  const identity = buildCompetitiveIdentity(row)
  return {
    stackId: row.stackId,
    rating: row.rating,
    tierId: identity.competitiveStatus === 'ranked' ? row.tierId : null,
    gamesPlayed: row.gamesPlayed,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    peakRating: row.peakRating,
    ...identity,
  }
}

/** Public, safe-to-expose profile with competitive identity. */
export async function getPublicProfile(db: Database, handle: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.handle, handle),
    with: { user: true, equippedTitle: true },
  })
  if (!profile || profile.user.status !== 'active') return null

  const ratings = await getUserRatings(db, profile.userId)
  const awards = await getUserAwards(db, profile.userId)

  const best = ratings.reduce<(typeof ratings)[number] | null>(
    (top, r) => (!top || r.rating > top.rating ? r : top),
    null,
  )
  const identity = best
    ? buildCompetitiveIdentity(best)
    : {
        competitiveStatus: 'unranked' as const,
        placementMatchesRequired: 0,
        placementMatchesCompleted: 0,
        placementRemaining: 0,
      }
  const ranked = identity.competitiveStatus === 'ranked'

  return {
    handle: profile.handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    region: profile.region,
    bio: profile.bio,
    memberSince: profile.createdAt,
    equippedTitle: profile.equippedTitle
      ? {
          code: profile.equippedTitle.code,
          name: profile.equippedTitle.name,
          rarity: profile.equippedTitle.rarity,
        }
      : null,
    ...identity,
    // Rating/tier are competitive identity — hidden publicly until the
    // server has actually placed the player.
    bestRating: ranked ? best?.rating ?? null : null,
    bestStackId: ranked ? best?.stackId ?? null : null,
    tierId: ranked ? best?.tierId ?? null : null,
    titles: awards.map((a) => ({
      code: a.title.code,
      name: a.title.name,
      kind: a.title.kind,
      rarity: a.title.rarity,
      awardedAt: a.awardedAt,
    })),
    ratings: ratings.map((r) => {
      const isRanked = competitiveStatusOf(r.placementRemaining) === 'ranked'
      return {
        stackId: r.stackId,
        rating: isRanked ? r.rating : null,
        tierId: isRanked ? r.tierId : null,
        gamesPlayed: r.gamesPlayed,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        peakRating: isRanked ? r.peakRating : null,
        placementRemaining: r.placementRemaining,
        placementCompleted: placementMatchesCompleted(r.placementRemaining),
      }
    }),
  }
}

export async function listStacks(db: Database) {
  return db.query.stacks.findMany({ where: eq(schema.stacks.isActive, true) })
}

/**
 * Marks first-time onboarding complete and records the preferred stack.
 * Competitive state (placements, ratings) is NOT touched here — it was
 * initialized by the registration service; this only stores the preference
 * and the server-authoritative completion marker.
 */
export async function completeOnboarding(
  db: Database,
  userId: string,
  input: CompleteOnboardingInput,
) {
  const stack = await db.query.stacks.findFirst({
    where: eq(schema.stacks.id, input.primaryStackId),
  })
  if (!stack || !stack.isActive) {
    throw new AppError(ErrorCodes.VALIDATION, 'Unknown or inactive stack', 400)
  }

  const [profile] = await db
    .update(schema.userProfiles)
    .set({
      primaryStackId: stack.id,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.userProfiles.userId, userId))
    .returning()

  if (!profile) throw new AppError(ErrorCodes.NOT_FOUND, 'Profile not found', 404)

  await writeAuditLog(db, {
    actorUserId: userId,
    action: 'profile.onboarded',
    resourceType: 'user_profile',
    resourceId: userId,
    metadata: { primaryStackId: stack.id },
  })

  return profile
}

export async function getCurrentSeason(db: Database) {
  return db.query.seasons.findFirst({ where: eq(schema.seasons.status, 'active') })
}
