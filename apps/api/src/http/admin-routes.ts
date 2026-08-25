import type { FastifyInstance, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  AppError,
  ErrorCodes,
  createQuestionSchema,
  createQuestionVersionSchema,
  addTestCasesSchema,
  updateQuestionMetaSchema,
  listAdminQuestionsQuerySchema,
  createEventSchema,
  createTournamentSchema,
  hasPermission,
  type AdminPermission,
} from '@clutch/shared'
import { schema } from '@clutch/db'
import {
  createQuestionDraft,
  createQuestion,
  updateQuestionMeta,
  upsertDraftContent,
  addTestCasesToLatestVersion,
  publishQuestion,
  unpublishQuestion,
  archiveQuestion,
  listQuestionsForAdmin,
  getQuestionStats,
  createEvent,
  createTournament,
  seedRounds,
  startTournament,
  cancelTournament,
  writeAuditLog,
  getAdminOverview,
  listAdminMatches,
  inspectMatch,
  joinMatchAsObserver,
  leaveMatchObservation,
  adjudicateMatch,
  listAdminUsers,
  inspectAdminUser,
  setUserStatus,
  listAuditLog,
  listAbuseFlags,
  reviewAbuseFlag,
  isTitleCriteria,
} from '@clutch/domain'
import { requireAuth, requirePermission } from '../middleware/auth.js'

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'Invalid request', 400)
  }
  return parsed.data
}

function adminOf(
  permission: AdminPermission,
): [(request: FastifyRequest) => Promise<void>, (request: FastifyRequest) => void] {
  return [requireAuth, requirePermission(permission)]
}

const auditAction = async (
  app: FastifyInstance,
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
) =>
  writeAuditLog(app.db, {
    actorUserId: userId,
    action,
    resourceType,
    resourceId,
    metadata,
  })

const createQuestionAdminSchema = createQuestionSchema.extend({
  publish: z.boolean().optional(),
})

const titleDefinitionSchema = z.object({
  code: z.string().min(2).max(64).regex(/^[a-z0-9_]+$/),
  name: z.string().min(2).max(80),
  description: z.string().min(2).max(300),
  kind: z.enum(['title', 'badge']).default('title'),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).default('common'),
  isSecret: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(0),
})

/**
 * ADMIN CONSOLE API.
 *
 * Security invariants:
 * - EVERY route requires an authenticated session AND a specific permission
 *   verified against the DB-backed role. Hidden UI is never the security layer.
 * - Administrator bootstrap happens via CLI only — no HTTP route can create
 *   or elevate administrators.
 * - Audit history is append-only: no route below can delete or rewrite it.
 */
export async function registerAdminRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // Dashboard / overview
  // -------------------------------------------------------------------------
  app.get('/admin/overview', { preHandler: adminOf('admin.dashboard.view') }, async (request) => {
    return getAdminOverview(app.db)
  })

  // -------------------------------------------------------------------------
  // Match monitoring & inspection
  // -------------------------------------------------------------------------
  app.get('/admin/matches', { preHandler: adminOf('admin.matches.view') }, async () => {
    return { matches: await listAdminMatches(app.db) }
  })

  app.get('/admin/matches/:matchId', { preHandler: adminOf('admin.matches.inspect') }, async (request) => {
    const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params)
    const inspection = await inspectMatch(app.db, matchId)
    await auditAction(app, request.user!.id, 'admin.match.inspect', 'match', inspection.publicId)
    return { match: inspection }
  })

  // Join as OBSERVER — server-generated event; never creates a participant.
  app.post('/admin/matches/:matchId/observe', { preHandler: adminOf('admin.matches.inspect') }, async (request) => {
    const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params)
    return joinMatchAsObserver(app.db, app.redis, matchId, {
      userId: request.user!.id,
      handle: request.user!.profile?.handle ?? null,
    })
  })

  app.delete('/admin/matches/:matchId/observe', { preHandler: adminOf('admin.matches.inspect') }, async (request) => {
    const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params)
    return leaveMatchObservation(app.db, app.redis, matchId, {
      userId: request.user!.id,
      handle: request.user!.profile?.handle ?? null,
    })
  })

  // Administrative override — separate, audited, exactly-once privilege.
  app.post(
    '/admin/matches/:matchId/adjudicate',
    { preHandler: adminOf('admin.matches.adjudicate') },
    async (request) => {
      const { matchId } = parse(z.object({ matchId: z.string().uuid() }), request.params)
      const input = parse(
        z.object({
          winnerUserId: z.string().uuid(),
          reason: z.string().min(10).max(1000),
        }),
        request.body,
      )
      const match = await adjudicateMatch(app.db, app.redis, {
        matchId,
        ...input,
        adminUserId: request.user!.id,
      })
      await auditAction(app, request.user!.id, 'admin.match.adjudicated_api', 'match', match.publicId)
      return {
        match: {
          id: match.id,
          publicId: match.publicId,
          status: match.status,
          winnerUserId: match.winnerUserId,
          resolveReason: match.resolveReason,
          resolution: 'ADMIN_ADJUDICATION',
        },
      }
    },
  )

  // -------------------------------------------------------------------------
  // Question administration (permission-scoped per operation)
  // -------------------------------------------------------------------------
  app.post('/admin/questions', { preHandler: adminOf('admin.questions.create') }, async (request, reply) => {
    const { publish: publishNow, ...input } = parse(createQuestionAdminSchema, request.body)
    const result = publishNow ? await createQuestion(app.db, input) : await createQuestionDraft(app.db, input)

    await auditAction(app, request.user!.id, 'admin.question.created', 'question', result.question.id, {
      slug: result.question.slug,
      status: result.question.status,
    })

    void reply.code(201)
    return result
  })

  app.get('/admin/questions', { preHandler: adminOf('admin.questions.edit') }, async (request) => {
    const query = parse(listAdminQuestionsQuerySchema, request.query)
    return { questions: await listQuestionsForAdmin(app.db, query) }
  })

  app.patch('/admin/questions/:questionId', { preHandler: adminOf('admin.questions.edit') }, async (request) => {
    const { questionId } = parse(z.object({ questionId: z.string().uuid() }), request.params)
    const input = parse(updateQuestionMetaSchema, request.body)
    const question = await updateQuestionMeta(app.db, questionId, input)
    await auditAction(app, request.user!.id, 'admin.question.edited', 'question', questionId)
    return { question }
  })

  app.post('/admin/questions/:questionId/content', { preHandler: adminOf('admin.questions.edit') }, async (request) => {
    const { questionId } = parse(z.object({ questionId: z.string().uuid() }), request.params)
    const input = parse(createQuestionVersionSchema, request.body)
    const version = await upsertDraftContent(app.db, questionId, input)
    await auditAction(app, request.user!.id, 'admin.question.version_created', 'question', questionId, {
      versionId: version.id,
      versionNumber: version.version,
    })
    return { version }
  })

  app.post('/admin/questions/:questionId/tests', { preHandler: adminOf('admin.questions.edit') }, async (request, reply) => {
    const { questionId } = parse(z.object({ questionId: z.string().uuid() }), request.params)
    const input = parse(addTestCasesSchema, request.body)
    // Hidden tests are accepted for storage and NEVER echoed back.
    await addTestCasesToLatestVersion(app.db, questionId, input.testCases)
    await auditAction(app, request.user!.id, 'admin.question.tests_added', 'question', questionId, {
      count: input.testCases.length,
    })
    void reply.code(201)
    return { added: input.testCases.length }
  })

  app.post('/admin/questions/:questionId/publish', { preHandler: adminOf('admin.questions.publish') }, async (request) => {
    const { questionId } = parse(z.object({ questionId: z.string().uuid() }), request.params)
    const question = await publishQuestion(app.db, questionId)
    await auditAction(app, request.user!.id, 'admin.question.published', 'question', questionId)
    return { question }
  })

  app.post('/admin/questions/:questionId/unpublish', { preHandler: adminOf('admin.questions.publish') }, async (request) => {
    const { questionId } = parse(z.object({ questionId: z.string().uuid() }), request.params)
    const question = await unpublishQuestion(app.db, questionId)
    await auditAction(app, request.user!.id, 'admin.question.unpublished', 'question', questionId)
    return { question }
  })

  app.post('/admin/questions/:questionId/archive', { preHandler: adminOf('admin.questions.archive') }, async (request) => {
    const { questionId } = parse(z.object({ questionId: z.string().uuid() }), request.params)
    const question = await archiveQuestion(app.db, questionId)
    await auditAction(app, request.user!.id, 'admin.question.archived', 'question', questionId)
    return { question }
  })

  app.get('/admin/questions/:questionId/stats', { preHandler: adminOf('admin.questions.edit') }, async (request) => {
    const { questionId } = parse(z.object({ questionId: z.string().uuid() }), request.params)
    return getQuestionStats(app.db, questionId)
  })

  // -------------------------------------------------------------------------
  // User management
  // -------------------------------------------------------------------------
  app.get('/admin/users', { preHandler: adminOf('admin.users.view') }, async (request) => {
    const query = parse(
      z.object({
        query: z.string().max(32).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
      request.query,
    )
    return { users: await listAdminUsers(app.db, query.query, query.limit) }
  })

  app.get('/admin/users/:userId', { preHandler: adminOf('admin.users.view') }, async (request) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), request.params)
    // Security tier (email/IP/session metadata) requires its OWN permission;
    // ordinary admins do not automatically hold it.
    const includeSecurity = request.user
      ? hasPermission(request.user.role, 'admin.security.view')
      : false
    if (includeSecurity && request.user) {
      await auditAction(app, request.user.id, 'admin.user.security_view', 'user', userId)
    }
    return { user: await inspectAdminUser(app.db, userId, { includeSecurity }) }
  })

  app.patch('/admin/users/:userId/status', { preHandler: adminOf('admin.users.moderate') }, async (request) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), request.params)
    const input = parse(z.object({ status: z.enum(['active', 'suspended', 'banned']) }), request.body)
    return { user: await setUserStatus(app.db, request.user!.id, userId, input.status) }
  })

  // -------------------------------------------------------------------------
  // Moderation queue (abuse flags)
  // -------------------------------------------------------------------------
  app.get('/admin/moderation/flags', { preHandler: adminOf('admin.users.view') }, async (request) => {
    const query = parse(
      z.object({ status: z.enum(['open', 'reviewed', 'actioned', 'dismissed', 'all']).default('open') }),
      request.query,
    )
    return { flags: await listAbuseFlags(app.db, query.status) }
  })

  app.post('/admin/moderation/flags/:flagId/review', { preHandler: adminOf('admin.users.moderate') }, async (request) => {
    const { flagId } = parse(z.object({ flagId: z.string().uuid() }), request.params)
    const input = parse(z.object({ decision: z.enum(['reviewed', 'actioned', 'dismissed']) }), request.body)
    return { flag: await reviewAbuseFlag(app.db, request.user!.id, flagId, input.decision) }
  })

  // -------------------------------------------------------------------------
  // Audit log — READ-ONLY by design. No delete/update endpoint exists.
  // -------------------------------------------------------------------------
  app.get('/admin/audit', { preHandler: adminOf('admin.audit.view') }, async (request) => {
    const query = parse(
      z.object({
        action: z.string().max(64).optional(),
        adminUserId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
      }),
      request.query,
    )
    return { entries: await listAuditLog(app.db, query) }
  })

  // -------------------------------------------------------------------------
  // Events & tournaments administration
  // -------------------------------------------------------------------------
  app.post('/admin/events', { preHandler: adminOf('admin.events.create') }, async (request, reply) => {
    const input = parse(createEventSchema, request.body)
    const event = await createEvent(app.db, input)
    await auditAction(app, request.user!.id, 'admin.event.created', 'event', event?.id ?? '', {
      slug: event?.slug ?? null,
    })
    void reply.code(201)
    return { event }
  })

  app.post('/admin/tournaments', { preHandler: adminOf('admin.tournaments.manage') }, async (request, reply) => {
    const input = parse(createTournamentSchema, request.body)
    const tournament = await createTournament(app.db, app.redis, input)
    await auditAction(app, request.user!.id, 'admin.tournament.created', 'tournament', tournament?.id ?? '', {
      slug: tournament?.slug ?? null,
    })
    void reply.code(201)
    return { tournament }
  })

  app.post('/admin/tournaments/:slug/seed-rounds', { preHandler: adminOf('admin.tournaments.manage') }, async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    const rounds = await seedRounds(app.db, slug)
    await auditAction(app, request.user!.id, 'admin.tournament.seeded_rounds', 'tournament', slug)
    return { rounds }
  })

  app.post('/admin/tournaments/:slug/start', { preHandler: adminOf('admin.tournaments.manage') }, async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    const result = await startTournament(app.db, app.redis, slug, request.user!.id)
    return result
  })

  app.post('/admin/tournaments/:slug/cancel', { preHandler: adminOf('admin.tournaments.manage') }, async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    const result = await cancelTournament(app.db, app.redis, slug, request.user!.id)
    return result
  })

  // -------------------------------------------------------------------------
  // Title definitions (data-driven; criteria validated structurally)
  // -------------------------------------------------------------------------
  app.post('/admin/titles', { preHandler: adminOf('admin.titles.manage') }, async (request, reply) => {
    const { criteria, ...definition } = parse(titleDefinitionSchema.extend({ criteria: z.unknown() }), request.body)
    if (!isTitleCriteria(criteria)) {
      throw new AppError(ErrorCodes.VALIDATION, 'Invalid title criteria document', 400)
    }

    const existing = await app.db.query.titles.findFirst({
      where: eq(schema.titles.code, definition.code),
    })
    if (existing) throw new AppError(ErrorCodes.CONFLICT, 'Title code already exists', 409)

    const [created] = await app.db
      .insert(schema.titles)
      .values({ ...definition, criteria })
      .returning()

    await auditAction(app, request.user!.id, 'admin.title.created', 'title', definition.code)
    void reply.code(201)
    return { title: created }
  })
}
