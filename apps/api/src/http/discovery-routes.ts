import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  AppError,
  ErrorCodes,
  createRoomSchema,
  joinRoomSchema,
  listRoomsQuerySchema,
  listEventsQuerySchema,
} from '@clutch/shared'
import {
  getDashboard,
  getTitleCatalogForUser,
  equipTitle,
  listLiveMatches,
  listRecentResults,
  getSpectatorSnapshot,
  createRoom,
  joinRoom,
  leaveRoom,
  setRoomReady,
  getRoomDetail,
  listOpenRooms,
  startRoomMatch,
  getCurrentSeason,
  listEvents,
  getEvent,
  registerForEvent,
  unregisterForEvent,
  getEventStandings,
  listTournaments,
  getTournament,
  registerForTournament,
  unregisterForTournament,
  listParticipants,
} from '@clutch/domain'
import { requireAuth } from '../middleware/auth.js'

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'Invalid request', 400)
  }
  return parsed.data
}

/** Player-facing discovery surfaces: dashboard, explore, rooms, events,
 *  tournaments and title management. All competitive state stays server-side. */
export async function registerDiscoveryRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // Home dashboard (PlayerCard + sanitized recents)
  // -------------------------------------------------------------------------
  app.get('/dashboard', { preHandler: [requireAuth] }, async (request) => {
    const dashboard = await getDashboard(request.server.db, request.user!.id)
    if (!dashboard) throw new AppError(ErrorCodes.NOT_FOUND, 'Profile not found', 404)
    return dashboard
  })

  // -------------------------------------------------------------------------
  // Titles: discovery catalog + equipping (ownership enforced server-side)
  // -------------------------------------------------------------------------
  app.get('/titles/catalog', { preHandler: [requireAuth] }, async (request) => {
    return { titles: await getTitleCatalogForUser(request.server.db, request.user!.id) }
  })

  app.post('/titles/equip', { preHandler: [requireAuth] }, async (request) => {
    const input = parse(
      z.object({ titleCode: z.string().min(1).max(64).nullable() }),
      request.body,
    )
    const result = await equipTitle(request.server.db, request.user!.id, input.titleCode)
    return result
  })

  // -------------------------------------------------------------------------
  // Explore hub
  // -------------------------------------------------------------------------
  app.get('/explore/live', async () => {
    return { liveMatches: await listLiveMatches(app.db) }
  })

  app.get('/explore/results', async () => {
    return { results: await listRecentResults(app.db) }
  })

  app.get('/spectate/:publicId', async (request) => {
    const { publicId } = parse(
      z.object({ publicId: z.string().regex(/^CL-[0-9a-fA-F]{8}$/) }),
      request.params,
    )
    const snapshot = await getSpectatorSnapshot(app.db, publicId)
    if (!snapshot) throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404)
    return { match: snapshot }
  })

  // -------------------------------------------------------------------------
  // Custom rooms
  // -------------------------------------------------------------------------
  app.post('/rooms', { preHandler: [requireAuth] }, async (request, reply) => {
    const input = parse(createRoomSchema, request.body)
    const room = await createRoom(app.db, request.user!.id, input)
    void reply.code(201)
    return { room }
  })

  app.get('/rooms', async (request) => {
    const query = parse(listRoomsQuerySchema, request.query)
    return { rooms: await listOpenRooms(app.db, query.limit, query.offset) }
  })

  app.get('/rooms/:roomId', async (request) => {
    const { roomId } = parse(z.object({ roomId: z.string().uuid() }), request.params)
    const room = await getRoomDetail(app.db, roomId, request.user?.id)
    if (!room) throw new AppError(ErrorCodes.NOT_FOUND, 'Room not found', 404)
    return { room }
  })

  app.post('/rooms/:roomId/join', { preHandler: [requireAuth] }, async (request) => {
    const { roomId } = parse(z.object({ roomId: z.string().uuid() }), request.params)
    const body = joinRoomSchema.safeParse(request.body ?? {})
    const result = await joinRoom(app.db, roomId, request.user!.id, body.success ? body.data.joinCode : undefined)
    return result
  })

  app.delete('/rooms/:roomId/leave', { preHandler: [requireAuth] }, async (request) => {
    const { roomId } = parse(z.object({ roomId: z.string().uuid() }), request.params)
    return leaveRoom(app.db, roomId, request.user!.id)
  })

  app.post('/rooms/:roomId/ready', { preHandler: [requireAuth] }, async (request) => {
    const { roomId } = parse(z.object({ roomId: z.string().uuid() }), request.params)
    const input = parse(z.object({ ready: z.boolean() }), request.body)
    return setRoomReady(app.db, roomId, request.user!.id, input.ready)
  })

  app.post('/rooms/:roomId/start', { preHandler: [requireAuth] }, async (request, reply) => {
    const { roomId } = parse(z.object({ roomId: z.string().uuid() }), request.params)
    const season = await getCurrentSeason(app.db)
    if (!season) throw new AppError(ErrorCodes.CONFLICT, 'No active season', 409)
    const match = await startRoomMatch(
      app.db,
      app.redis,
      season.id,
      roomId,
      request.user!.id,
    )
    void reply.code(201)
    return { match: { id: match.id, publicId: match.publicId } }
  })

  // -------------------------------------------------------------------------
  // Events (server-time authoritative phases)
  // -------------------------------------------------------------------------
  app.get('/events', async (request) => {
    const query = parse(listEventsQuerySchema, request.query)
    return {
      events: await listEvents(app.db, {
        phase: query.phase,
        limit: query.limit,
        offset: query.offset,
      }),
    }
  })

  app.get('/events/:slug', async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    const event = await getEvent(app.db, slug)
    if (!event) throw new AppError(ErrorCodes.NOT_FOUND, 'Event not found', 404)
    return { event }
  })

  app.post('/events/:slug/register', { preHandler: [requireAuth] }, async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    return registerForEvent(app.db, slug, request.user!.id)
  })

  app.delete('/events/:slug/register', { preHandler: [requireAuth] }, async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    return unregisterForEvent(app.db, slug, request.user!.id)
  })

  app.get('/events/:slug/standings', async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    return { standings: await getEventStandings(app.db, slug) }
  })

  // -------------------------------------------------------------------------
  // Tournaments
  // -------------------------------------------------------------------------
  app.get('/tournaments', async () => {
    return { tournaments: await listTournaments(app.db) }
  })

  app.get('/tournaments/:slug', async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    const tournament = await getTournament(app.db, slug)
    if (!tournament) throw new AppError(ErrorCodes.NOT_FOUND, 'Tournament not found', 404)
    return { tournament }
  })

  app.post('/tournaments/:slug/register', { preHandler: [requireAuth] }, async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    return registerForTournament(app.db, slug, request.user!.id)
  })

  app.delete('/tournaments/:slug/register', { preHandler: [requireAuth] }, async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    return unregisterForTournament(app.db, slug, request.user!.id)
  })

  app.get('/tournaments/:slug/participants', async (request) => {
    const { slug } = parse(z.object({ slug: z.string().min(3).max(64) }), request.params)
    return { participants: await listParticipants(app.db, slug) }
  })
}
