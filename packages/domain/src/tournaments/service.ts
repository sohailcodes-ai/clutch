import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import {
  AppError,
  ErrorCodes,
  canRegisterForTournament,
  type CreateTournamentInput,
  type UpdateTournamentInput,
} from '@clutch/shared'
import { generateBracket, createRoundMatches, advanceTournament, getTournamentBracket } from './bracket.js'
import { publishTournamentEvent } from '../realtime/pubsub.js'
import { writeAuditLog } from '../audit.js'

/**
 * Tournament service. Provides tournaments, registrations, rounds, bracket
 * generation and lifecycle management. Integrates with the existing match
 * engine for actual competitive play.
 */

export async function createTournament(db: Database, redis: import('ioredis').Redis, input: CreateTournamentInput) {
  if (input.registrationClosesAt > input.startsAt) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'Registration must close before the tournament starts',
      400,
    )
  }
  const stack = await db.query.stacks.findFirst({ where: eq(schema.stacks.id, input.stackId) })
  if (!stack || !stack.isActive) {
    throw new AppError(ErrorCodes.VALIDATION, 'Unknown or inactive stack', 400)
  }
  const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.status, 'active') })
  if (!season) throw new AppError(ErrorCodes.CONFLICT, 'No active season', 409)

  const [tournament] = await db
    .insert(schema.tournaments)
    .values({
      slug: input.slug,
      name: input.name,
      descriptionMd: input.descriptionMd ?? null,
      format: input.format,
      seasonId: season.id,
      stackId: input.stackId,
      maxParticipants: input.maxParticipants,
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      startsAt: input.startsAt,
      status: 'registration_open',
    })
    .returning()

  if (!tournament) throw new AppError(ErrorCodes.INTERNAL, 'Failed to create tournament', 500)

  await publishTournamentEvent(redis, tournament.id, {
    type: 'tournament.created',
    payload: { tournamentId: tournament.id, slug: tournament.slug, name: tournament.name },
  })

  return tournament
}

export async function updateTournament(
  db: Database,
  redis: import('ioredis').Redis,
  slug: string,
  adminUserId: string,
  input: UpdateTournamentInput,
) {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.slug, slug),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)
  if (!['draft', 'registration_open'].includes(tournament.status)) {
    throw new AppError(ErrorCodes.CONFLICT, 'Tournament cannot be edited in current status', 409)
  }

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.descriptionMd !== undefined) updates.descriptionMd = input.descriptionMd
  if (input.maxParticipants !== undefined) updates.maxParticipants = input.maxParticipants
  if (input.startsAt !== undefined) updates.startsAt = input.startsAt

  if (Object.keys(updates).length > 0) {
    await db.update(schema.tournaments).set(updates).where(eq(schema.tournaments.id, tournament.id))
  }

  await publishTournamentEvent(redis, tournament.id, {
    type: 'tournament.updated',
    actorUserId: adminUserId,
    payload: { tournamentId: tournament.id, slug, updates: Object.keys(updates) },
  })

  await writeAuditLog(db, {
    actorUserId: adminUserId,
    action: 'admin.tournament.update',
    resourceType: 'tournament',
    resourceId: slug,
    metadata: { updates },
  })

  return { updated: true }
}

export async function listTournaments(db: Database, limit = 20, offset = 0) {
  const now = new Date()
  const rows = await db.query.tournaments.findMany({
    with: { stack: true, registrations: { columns: { userId: true } } },
    orderBy: (t, { asc: a }) => a(t.startsAt),
    limit,
    offset,
  })

  return rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    descriptionMd: t.descriptionMd,
    format: t.format,
    status: t.status,
    stackId: t.stackId,
    stackName: t.stack.name,
    maxParticipants: t.maxParticipants,
    registeredCount: t.registrations.length,
    registrationOpensAt: t.registrationOpensAt.toISOString(),
    registrationClosesAt: t.registrationClosesAt.toISOString(),
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt?.toISOString() ?? null,
    championHandle: null as string | null,
    serverTimeMs: now.getTime(),
  }))
}

export async function getTournament(db: Database, slug: string) {
  const now = new Date()
  const t = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.slug, slug),
    with: { stack: true, registrations: { columns: { userId: true } }, rounds: true },
  })
  if (!t) return null

  let championHandle: string | null = null
  if (t.championUserId) {
    const champ = await db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, t.championUserId),
    })
    championHandle = champ?.handle ?? null
  }

  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    descriptionMd: t.descriptionMd,
    format: t.format,
    status: t.status,
    stackId: t.stackId,
    stackName: t.stack.name,
    maxParticipants: t.maxParticipants,
    registeredCount: t.registrations.length,
    registrationOpensAt: t.registrationOpensAt.toISOString(),
    registrationClosesAt: t.registrationClosesAt.toISOString(),
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt?.toISOString() ?? null,
    championHandle,
    rounds: [...t.rounds]
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((r) => ({ roundNumber: r.roundNumber, name: r.name, status: r.status })),
    serverTimeMs: now.getTime(),
  }
}

export async function registerForTournament(db: Database, slug: string, userId: string) {
  const now = new Date()
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.slug, slug),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)

  const regCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.tournamentRegistrations)
    .where(eq(schema.tournamentRegistrations.tournamentId, tournament.id))

  const check = canRegisterForTournament(now, {
    status: tournament.status,
    registrationOpensAt: tournament.registrationOpensAt,
    registrationClosesAt: tournament.registrationClosesAt,
    startsAt: tournament.startsAt,
    maxParticipants: tournament.maxParticipants,
    registeredCount: Number(regCount[0]?.count ?? 0),
  })
  if (!check.ok) throw new AppError(ErrorCodes.VALIDATION, check.reason, 409)

  const existing = await db.query.tournamentRegistrations.findFirst({
    where: and(
      eq(schema.tournamentRegistrations.tournamentId, tournament.id),
      eq(schema.tournamentRegistrations.userId, userId),
    ),
  })
  if (existing) throw new AppError(ErrorCodes.CONFLICT, 'Already registered', 409)

  await db
    .insert(schema.tournamentRegistrations)
    .values({ tournamentId: tournament.id, userId })
    .onConflictDoNothing()
  return { registered: true }
}

export async function unregisterForTournament(db: Database, slug: string, userId: string) {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.slug, slug),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)
  if (tournament.status !== 'registration_open') {
    throw new AppError(ErrorCodes.CONFLICT, 'Registration is closed', 409)
  }

  const deleted = await db
    .delete(schema.tournamentRegistrations)
    .where(
      and(
        eq(schema.tournamentRegistrations.tournamentId, tournament.id),
        eq(schema.tournamentRegistrations.userId, userId),
      ),
    )
    .returning()
  return { unregistered: deleted.length > 0 }
}

export async function listParticipants(db: Database, slug: string) {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.slug, slug),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)

  const rows = await db.query.tournamentRegistrations.findMany({
    where: eq(schema.tournamentRegistrations.tournamentId, tournament.id),
    with: { user: { with: { profile: true } } },
    orderBy: (r, { asc: a }) => [asc(r.seed), a(r.registeredAt)],
  })

  return rows.map((r) => ({
    handle: r.user.profile?.handle ?? null,
    avatarUrl: r.user.profile?.avatarUrl ?? null,
    seed: r.seed,
    registeredAt: r.registeredAt.toISOString(),
  }))
}

/** Creates the round skeleton once registration closes (admin action). */
export async function seedRounds(
  db: Database,
  slug: string,
  roundNames: string[] = ['Quarterfinals', 'Semifinals', 'Final'],
) {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.slug, slug),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)
  if (tournament.status === 'completed') {
    throw new AppError(ErrorCodes.CONFLICT, 'Tournament already completed', 409)
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.tournamentBracketNodes).where(
      eq(schema.tournamentBracketNodes.tournamentId, tournament.id),
    )
    await tx.delete(schema.tournamentRounds).where(eq(schema.tournamentRounds.tournamentId, tournament.id))
    await tx.insert(schema.tournamentRounds).values(
      roundNames.map((name, i) => ({
        tournamentId: tournament.id,
        roundNumber: i + 1,
        name,
        status: 'pending' as const,
      })),
    )
    // Keep status unless already further along.
    if (!['running', 'completed'].includes(tournament.status)) {
      await tx
        .update(schema.tournaments)
        .set({ status: 'seeding' })
        .where(eq(schema.tournaments.id, tournament.id))
    }
  })

  const rounds = await db.query.tournamentRounds.findMany({
    where: eq(schema.tournamentRounds.tournamentId, tournament.id),
    orderBy: (r, { asc }) => [asc(r.roundNumber)],
  })
  return rounds
}

/**
 * Start a tournament: lock registration, generate bracket, create first-round matches.
 */
export async function startTournament(
  db: Database,
  redis: import('ioredis').Redis,
  slug: string,
  adminUserId: string,
) {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.slug, slug),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)
  if (!['registration_open', 'seeding'].includes(tournament.status)) {
    throw new AppError(ErrorCodes.CONFLICT, 'Tournament cannot be started in current status', 409)
  }

  const regCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.tournamentRegistrations)
    .where(eq(schema.tournamentRegistrations.tournamentId, tournament.id))
  if (Number(regCount[0]?.count ?? 0) < 2) {
    throw new AppError(ErrorCodes.VALIDATION, 'Need at least 2 participants to start', 400)
  }

  // Set status to seeding if currently registration_open
  if (tournament.status === 'registration_open') {
    await db
      .update(schema.tournaments)
      .set({ status: 'seeding' })
      .where(eq(schema.tournaments.id, tournament.id))
  }

  // Generate bracket (this also sets status to 'running')
  const { rounds } = await generateBracket(db, tournament.id)

  // Create first-round matches
  const { matchCount } = await createRoundMatches(db, redis, tournament.id, 1)

  await writeAuditLog(db, {
    actorUserId: adminUserId,
    action: 'admin.tournament.start',
    resourceType: 'tournament',
    resourceId: slug,
    metadata: { rounds: rounds.length, firstRoundMatches: matchCount },
  })

  await publishTournamentEvent(redis, tournament.id, {
    type: 'tournament.started',
    actorUserId: adminUserId,
    payload: { rounds: rounds.length, firstRoundMatches: matchCount },
  })

  return { started: true, rounds: rounds.length, firstRoundMatches: matchCount }
}

/**
 * Cancel a tournament. Only draft/registration_open/seeding tournaments can be cancelled.
 */
export async function cancelTournament(
  db: Database,
  redis: import('ioredis').Redis,
  slug: string,
  adminUserId: string,
) {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.slug, slug),
  })
  if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)
  if (['completed', 'cancelled'].includes(tournament.status)) {
    throw new AppError(ErrorCodes.CONFLICT, 'Tournament is already finished', 409)
  }

  await db
    .update(schema.tournaments)
    .set({ status: 'cancelled', endsAt: new Date() })
    .where(eq(schema.tournaments.id, tournament.id))

  await writeAuditLog(db, {
    actorUserId: adminUserId,
    action: 'admin.tournament.cancel',
    resourceType: 'tournament',
    resourceId: slug,
    metadata: { previousStatus: tournament.status },
  })

  await publishTournamentEvent(redis, tournament.id, {
    type: 'tournament.cancelled',
    actorUserId: adminUserId,
    payload: { previousStatus: tournament.status },
  })

  return { cancelled: true }
}

/**
 * Handle post-match resolution for tournament matches.
 * Advances the bracket if needed.
 */
export async function handleTournamentMatchResolution(
  db: Database,
  redis: import('ioredis').Redis,
  matchId: string,
): Promise<void> {
  const match = await db.query.matches.findFirst({
    where: eq(schema.matches.id, matchId),
  })
  if (!match || !match.tournamentId) return

  const result = await advanceTournament(db, redis, matchId)

  if (result.tournamentComplete) {
    // Award reward titles to the champion if configured
    const tournament = await db.query.tournaments.findFirst({
      where: eq(schema.tournaments.id, match.tournamentId),
    })
    if (tournament?.championUserId && Array.isArray(tournament.rewardTitleIds) && tournament.rewardTitleIds.length > 0) {
      for (const titleId of tournament.rewardTitleIds) {
        await db
          .insert(schema.userTitles)
          .values({ userId: tournament.championUserId, titleId })
          .onConflictDoNothing()
      }
    }
    return
  }

  if (result.advanced && result.nextMatchCreated) {
    await publishTournamentEvent(redis, match.tournamentId, {
      type: 'tournament.match_created',
      payload: {
        matchId,
        winnerUserId: result.winnerUserId,
        roundNumber: null,
      },
    })
  }
}

export { getTournamentBracket }
