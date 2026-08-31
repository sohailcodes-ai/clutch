import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import { and, eq } from '@clutch/db'
import { schema } from '@clutch/db'
import { hasPermission, wsClientEvents } from '@clutch/shared'
import {
  getSessionUser,
  getMatchEventsSince,
  getMatchSnapshot,
  inspectMatch,
  hasActiveObservation,
  markReady,
  setPresence,
  getRoomDetail,
  getTournament,
  getTournamentBracket,
  listFriends,
  getMatchSnapshot as getMatchSnapshotForSpectator,
} from '@clutch/domain'
import { publishMatchEvent } from '@clutch/domain'

const clientMessageSchema = z.object({
  type: z.string().min(1).max(64),
  id: z.string().max(128).optional(),
  matchId: z.string().uuid().optional(),
  lastEventId: z.number().int().nonnegative().optional(),
  payload: z.unknown().optional(),
})

type ClientMessage = z.infer<typeof clientMessageSchema>

function send(ws: WebSocket, event: Record<string, unknown>) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event))
  }
}

function sendError(ws: WebSocket, message: string, code = 'ERROR') {
  send(ws, {
    type: 'error',
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    payload: { code, message },
  })
}

/**
 * Realtime gateway.
 *
 * Authorization model:
 * - The connection is authenticated with the session cookie before any events
 *   flow; unauthenticated sockets are closed immediately.
 * - A socket may only subscribe to its OWN user channel (`user:<self>`).
 * - Match channels require verified participation in that match (checked
 *   against PostgreSQL, never against a client claim).
 * - All inbound messages are schema-validated; malformed payloads are rejected.
 */
export async function registerWsRoutes(app: FastifyInstance) {
  const subscriberFactory = (): Redis => app.redis.duplicate()

  app.get('/ws', { websocket: true }, async (socket, request) => {
    // --- Authentication -----------------------------------------------------
    const token =
      request.cookies.clutch_session ??
      request.headers.authorization?.replace(/^Bearer\s+/i, '')

    if (!token) {
      socket.close(4001, 'unauthenticated')
      return
    }

    const user = await getSessionUser(request.server.db, token)
    if (!user) {
      socket.close(4001, 'unauthenticated')
      return
    }

    const userId = user.id

    // --- Subscription wiring -------------------------------------------------
    const subscriber = subscriberFactory()
    let alive = true

    subscriber.on('message', (channel: string, raw: string) => {
      if (!alive) return
      try {
        const parsed: unknown = JSON.parse(raw)
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'type' in parsed &&
          typeof (parsed as { type?: unknown }).type === 'string'
        ) {
          const envelope = parsed as {
            type: string
            id?: string
            ts?: string
            payload?: unknown
            matchId?: string
          }
          send(socket, {
            channel,
            ...envelope,
            id: envelope.id ?? crypto.randomUUID(),
            ts: envelope.ts ?? new Date().toISOString(),
          })
        }
      } catch {
        // Malformed internal message; drop rather than crash the socket.
      }
    })

    socket.on('close', () => {
      alive = false
      void subscriber.quit()
    })
    socket.on('error', () => {
      alive = false
      try {
        socket.close()
      } catch {
        // already closed
      }
      void subscriber.quit()
    })

    await subscriber.subscribe(`user:${userId}`)

    // --- Inbound message loop -------------------------------------------------
    socket.on('message', (raw: Buffer) => {
      void (async () => {
        let parsedJson: unknown
        try {
          parsedJson = JSON.parse(raw.toString('utf8'))
        } catch {
          sendError(socket, 'Malformed JSON')
          return
        }

        const msg: ClientMessage | null = clientMessageSchema.safeParse(parsedJson).success
          ? clientMessageSchema.parse(parsedJson)
          : null
        if (!msg) {
          sendError(socket, 'Invalid message')
          return
        }

        switch (msg.type) {
          case wsClientEvents.PRESENCE_PING: {
            await setPresence(request.server.redis, userId, msg.matchId)
            send(socket, { type: 'presence.ack', id: msg.id, ts: new Date().toISOString() })
            break
          }

          case wsClientEvents.QUEUE_SUBSCRIBE: {
            // Only ever the caller's own channel; a requested target is ignored.
            await subscriber.subscribe(`user:${userId}`)
            send(socket, { type: 'queue.subscribed', id: msg.id, ts: new Date().toISOString() })
            break
          }

          case wsClientEvents.MATCH_SUBSCRIBE: {
            if (!msg.matchId) {
              sendError(socket, 'matchId required')
              break
            }
            const snapshot = await getMatchSnapshot(
              request.server.db,
              msg.matchId,
              userId,
            )
            if (snapshot) {
              await subscriber.subscribe(`match:${msg.matchId}`)
              send(socket, {
                type: 'match.snapshot',
                id: crypto.randomUUID(),
                ts: new Date().toISOString(),
                matchId: msg.matchId,
                payload: { match: snapshot },
              })
              break
            }

            // Observer path: authorization is derived ENTIRELY from the
            // DB-backed session (role permission + server-recorded observation
            // state). A client claiming "admin" without both is rejected.
            if (
              hasPermission(user.role, 'admin.matches.inspect') &&
              (await hasActiveObservation(request.server.db, msg.matchId, userId))
            ) {
              const inspection = await inspectMatch(request.server.db, msg.matchId)
              await subscriber.subscribe(`match:${msg.matchId}`)
              send(socket, {
                type: 'observer.snapshot',
                id: crypto.randomUUID(),
                ts: new Date().toISOString(),
                matchId: msg.matchId,
                payload: { mode: 'admin_observer', observing: true, match: inspection },
              })
              break
            }

            // getMatchSnapshot returns null for non-participants: authorization
            // is derived from database state, not from the client claim.
            sendError(socket, 'Not authorized for this match', 'FORBIDDEN')
            break
          }

          case wsClientEvents.MATCH_READY: {
            if (!msg.matchId) {
              sendError(socket, 'matchId required')
              break
            }
            try {
              const result = await markReady(request.server.db, request.server.redis, {
                matchId: msg.matchId,
                userId,
              })
              send(socket, {
                type: 'match.ready_ack',
                id: msg.id ?? crypto.randomUUID(),
                ts: new Date().toISOString(),
                matchId: msg.matchId,
                payload: result,
              })
            } catch (err) {
              request.log.warn({ err }, 'ws_match_ready_failed')
              sendError(socket, 'Cannot ready up right now')
            }
            break
          }

          case wsClientEvents.MATCH_RESYNC: {
            if (!msg.matchId) {
              sendError(socket, 'matchId required')
              break
            }
            const snapshot = await getMatchSnapshot(request.server.db, msg.matchId, userId)
            let observerSnapshot: Awaited<ReturnType<typeof inspectMatch>> | null = null
            if (!snapshot) {
              if (
                hasPermission(user.role, 'admin.matches.inspect') &&
                (await hasActiveObservation(request.server.db, msg.matchId, userId))
              ) {
                observerSnapshot = await inspectMatch(request.server.db, msg.matchId)
              } else {
                sendError(socket, 'Not authorized for this match', 'FORBIDDEN')
                break
              }
            }
            const events = await getMatchEventsSince(
              request.server.db,
              msg.matchId,
              msg.lastEventId,
            )
            const effectiveMatchId = msg.matchId
            if (effectiveMatchId === null) break
            send(socket, {
              type: snapshot ? 'match.snapshot' : 'observer.snapshot',
              id: crypto.randomUUID(),
              ts: new Date().toISOString(),
              matchId: effectiveMatchId,
              payload: snapshot
                ? { match: snapshot, eventsSince: events.length }
                : { mode: 'admin_observer', observing: true, match: observerSnapshot, eventsSince: events.length },
            })
            for (const event of events.slice(-50)) {
              send(socket, {
                type: event.eventType,
                id: `evt-${event.id}`,
                ts: event.createdAt.toISOString(),
                matchId: msg.matchId,
                payload: event.payload,
              })
            }
            break
          }

          // --- Room subscriptions ---------------------------------------------
          case wsClientEvents.ROOM_SUBSCRIBE: {
            const roomId = (msg as { roomId?: string }).roomId
            if (!roomId) {
              sendError(socket, 'roomId required')
              break
            }
            const room = await getRoomDetail(request.server.db, roomId, userId)
            if (!room) {
              sendError(socket, 'Room not found or not a participant', 'NOT_FOUND')
              break
            }
            await subscriber.subscribe(`room:${roomId}`)
            send(socket, {
              type: 'room.snapshot',
              id: crypto.randomUUID(),
              ts: new Date().toISOString(),
              roomId,
              payload: { room },
            })
            break
          }

          case wsClientEvents.ROOM_RESYNC: {
            const roomId = (msg as { roomId?: string }).roomId
            if (!roomId) {
              sendError(socket, 'roomId required')
              break
            }
            const roomSnapshot = await getRoomDetail(request.server.db, roomId, userId)
            if (!roomSnapshot) {
              sendError(socket, 'Room not found or not a participant', 'NOT_FOUND')
              break
            }
            send(socket, {
              type: 'room.snapshot',
              id: crypto.randomUUID(),
              ts: new Date().toISOString(),
              roomId,
              payload: { room: roomSnapshot },
            })
            break
          }

          // --- Tournament subscriptions --------------------------------------
          case wsClientEvents.TOURNAMENT_SUBSCRIBE: {
            const tournamentSlug = (msg as { slug?: string }).slug
            if (!tournamentSlug) {
              sendError(socket, 'slug required')
              break
            }
            const tournament = await getTournament(request.server.db, tournamentSlug)
            if (!tournament) {
              sendError(socket, 'Tournament not found', 'NOT_FOUND')
              break
            }
            const bracket = await getTournamentBracket(request.server.db, tournament.id)
            await subscriber.subscribe(`tournament:${tournament.id}`)
            send(socket, {
              type: 'tournament.snapshot',
              id: crypto.randomUUID(),
              ts: new Date().toISOString(),
              tournamentId: tournament.id,
              payload: { tournament, bracket },
            })
            break
          }

          case wsClientEvents.TOURNAMENT_RESYNC: {
            const tournamentSlug = (msg as { slug?: string }).slug
            if (!tournamentSlug) {
              sendError(socket, 'slug required')
              break
            }
            const tDetail = await getTournament(request.server.db, tournamentSlug)
            if (!tDetail) {
              sendError(socket, 'Tournament not found', 'NOT_FOUND')
              break
            }
            const tBracket = await getTournamentBracket(request.server.db, tDetail.id)
            send(socket, {
              type: 'tournament.snapshot',
              id: crypto.randomUUID(),
              ts: new Date().toISOString(),
              tournamentId: tDetail.id,
              payload: { tournament: tDetail, bracket: tBracket },
            })
            break
          }

          // --- Friends subscription (presence of friends) --------------------
          case wsClientEvents.FRIENDS_SUBSCRIBE: {
            await subscriber.subscribe(`user:${userId}`)
            // Send current friends list with presence
            const friends = await listFriends(request.server.db, request.server.redis, userId)
            send(socket, {
              type: 'friends.snapshot',
              id: crypto.randomUUID(),
              ts: new Date().toISOString(),
              payload: { friends },
            })
            break
          }

          // --- Spectator subscription (live match viewing) -------------------
          case wsClientEvents.SPECTATOR_SUBSCRIBE: {
            if (!msg.matchId) {
              sendError(socket, 'matchId required')
              break
            }
            // Get the match to check if it allows live code spectating
            const specMatch = await request.server.db.query.matches.findFirst({
              where: eq(schema.matches.id, msg.matchId),
            })
            if (!specMatch) {
              sendError(socket, 'Match not found', 'NOT_FOUND')
              break
            }

            // Check if user is a participant (they get full access)
            const isParticipant = await request.server.db.query.matchParticipants.findFirst({
              where: and(
                eq(schema.matchParticipants.matchId, msg.matchId),
                eq(schema.matchParticipants.userId, userId),
              ),
            })

            // Check if user is admin observer
            const isAdminObserver =
              hasPermission(user.role, 'admin.matches.inspect') &&
              (await hasActiveObservation(request.server.db, msg.matchId, userId))

            // For spectators: allow if match is active and either:
            // 1. It's a non-ranked challenge match (allows live code)
            // 2. User is admin observer
            // 3. User is a participant
            const isChallengeMatch = !specMatch.ranked
            const isLiveCodeAllowed = isChallengeMatch || isAdminObserver || !!isParticipant

            if (!isParticipant && !isAdminObserver && specMatch.status !== 'active') {
              sendError(socket, 'Match is not available for spectating', 'FORBIDDEN')
              break
            }

            await subscriber.subscribe(`match:${msg.matchId}`)
            await subscriber.subscribe(`editor:${msg.matchId}`)

            // Send spectator count update
            const spectatorCountKey = `spectators:${msg.matchId}`
            await request.server.redis.incr(spectatorCountKey)
            await request.server.redis.expire(spectatorCountKey, 300)

            // Get the match snapshot
            const specSnapshot = await getMatchSnapshot(request.server.db, msg.matchId, userId)

            send(socket, {
              type: 'spectator.snapshot',
              id: crypto.randomUUID(),
              ts: new Date().toISOString(),
              matchId: msg.matchId,
              payload: {
                match: specSnapshot,
                liveCodeAllowed: isLiveCodeAllowed,
                mode: isParticipant ? 'participant' : isAdminObserver ? 'admin_observer' : 'spectator',
              },
            })

            // Broadcast spectator count
            const count = await request.server.redis.get(spectatorCountKey)
            await publishMatchEvent(request.server.redis, msg.matchId, {
              type: 'spectator.count',
              payload: { count: parseInt(count ?? '0', 10) },
            })
            break
          }

          // --- Spectator resync -----------------------------------------------
          case wsClientEvents.SPECTATOR_RESYNC: {
            if (!msg.matchId) {
              sendError(socket, 'matchId required')
              break
            }
            const resyncSnapshot = await getMatchSnapshot(request.server.db, msg.matchId, userId)
            const resyncEvents = await getMatchEventsSince(
              request.server.db,
              msg.matchId,
              msg.lastEventId,
            )
            send(socket, {
              type: 'spectator.snapshot',
              id: crypto.randomUUID(),
              ts: new Date().toISOString(),
              matchId: msg.matchId,
              payload: { match: resyncSnapshot, eventsSince: resyncEvents.length },
            })
            for (const event of resyncEvents.slice(-50)) {
              send(socket, {
                type: event.eventType,
                id: `evt-${event.id}`,
                ts: event.createdAt.toISOString(),
                matchId: msg.matchId,
                payload: event.payload,
              })
            }
            break
          }

          // --- Editor update (player sends, server broadcasts) ----------------
          case wsClientEvents.EDITOR_UPDATE: {
            if (!msg.matchId) {
              sendError(socket, 'matchId required')
              break
            }
            // Only match participants may send editor updates
            const editorParticipant = await request.server.db.query.matchParticipants.findFirst({
              where: and(
                eq(schema.matchParticipants.matchId, msg.matchId),
                eq(schema.matchParticipants.userId, userId),
              ),
            })
            if (!editorParticipant) {
              sendError(socket, 'Not a match participant', 'FORBIDDEN')
              break
            }

            // Check match is active
            const editorMatch = await request.server.db.query.matches.findFirst({
              where: eq(schema.matches.id, msg.matchId),
            })
            if (!editorMatch || editorMatch.status !== 'active') {
              sendError(socket, 'Match is not active', 'MATCH_NOT_ACTIVE')
              break
            }

            // Only broadcast for challenge (non-ranked) matches
            if (editorMatch.ranked) {
              // Silently accept but don't broadcast for ranked matches
              send(socket, {
                type: 'editor.update_ack',
                id: msg.id ?? crypto.randomUUID(),
                ts: new Date().toISOString(),
                matchId: msg.matchId,
                payload: { accepted: true, broadcast: false },
              })
              break
            }

            // Broadcast the editor update to spectators (not to the sender)
            const editorPayload = msg.payload as Record<string, unknown> | undefined
            await publishMatchEvent(request.server.redis, msg.matchId, {
              type: 'editor.update_broadcast',
              payload: {
                userId,
                slot: editorParticipant.slot,
                ...(editorPayload ?? {}),
              },
            })

            send(socket, {
              type: 'editor.update_ack',
              id: msg.id ?? crypto.randomUUID(),
              ts: new Date().toISOString(),
              matchId: msg.matchId,
              payload: { accepted: true, broadcast: true },
            })
            break
          }

          default:
            sendError(socket, 'Unknown message type')
        }
      })().catch((err) => {
        request.log.error({ err }, 'ws_message_handler_failed')
        sendError(socket, 'Internal error')
      })
    })
  })
}
