import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import {
  AppError,
  ErrorCodes,
  canRegisterForTournament,
  type CreateTournamentInput,
} from '@clutch/shared'

/**
 * Tournament FOUNDATION. Provides tournaments, registrations, rounds and
 * match association (matches.tournament_id). Full automated bracket
 * generation/seeding is intentionally out of scope for this increment; the
 * data model and registration lifecycle here are the contract that bracket
 * automation will build on. See "Remaining work" in the repo report.
 */

export async function createTournament(db: Database, input: CreateTournamentInput) {
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

  return tournament
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
