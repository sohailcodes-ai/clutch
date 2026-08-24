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
    bestRating: best?.rating ?? null,
    bestStackId: best?.stackId ?? null,
    tierId: best?.tierId ?? null,
    titles: awards.map((a) => ({
      code: a.title.code,
      name: a.title.name,
      kind: a.title.kind,
      rarity: a.title.rarity,
      awardedAt: a.awardedAt,
    })),
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
