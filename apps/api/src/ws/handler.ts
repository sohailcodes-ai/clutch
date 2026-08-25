import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import type { Redis } from 'ioredis'
import { z } from 'zod'
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
} from '@clutch/domain'

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
