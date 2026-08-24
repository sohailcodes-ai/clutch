import { z } from 'zod';
import { hasPermission, wsClientEvents } from '@clutch/shared';
import { getSessionUser, getMatchEventsSince, getMatchSnapshot, inspectMatch, hasActiveObservation, markReady, setPresence, } from '@clutch/domain';
const clientMessageSchema = z.object({
    type: z.string().min(1).max(64),
    id: z.string().max(128).optional(),
    matchId: z.string().uuid().optional(),
    lastEventId: z.number().int().nonnegative().optional(),
    payload: z.unknown().optional(),
});
function send(ws, event) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(event));
    }
}
function sendError(ws, message, code = 'ERROR') {
    send(ws, {
        type: 'error',
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        payload: { code, message },
    });
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
export async function registerWsRoutes(app) {
    const subscriberFactory = () => app.redis.duplicate();
    app.get('/ws', { websocket: true }, async (socket, request) => {
        // --- Authentication -----------------------------------------------------
        const token = request.cookies.clutch_session ??
            request.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) {
            socket.close(4001, 'unauthenticated');
            return;
        }
        const user = await getSessionUser(request.server.db, token);
        if (!user) {
            socket.close(4001, 'unauthenticated');
            return;
        }
        const userId = user.id;
        // --- Subscription wiring -------------------------------------------------
        const subscriber = subscriberFactory();
        let alive = true;
        subscriber.on('message', (channel, raw) => {
            if (!alive)
                return;
            try {
                const parsed = JSON.parse(raw);
                if (typeof parsed === 'object' &&
                    parsed !== null &&
                    'type' in parsed &&
                    typeof parsed.type === 'string') {
                    const envelope = parsed;
                    send(socket, {
                        channel,
                        ...envelope,
                        id: envelope.id ?? crypto.randomUUID(),
                        ts: envelope.ts ?? new Date().toISOString(),
                    });
                }
            }
            catch {
                // Malformed internal message; drop rather than crash the socket.
            }
        });
        socket.on('close', () => {
            alive = false;
            void subscriber.quit();
        });
        socket.on('error', () => {
            alive = false;
            try {
                socket.close();
            }
            catch {
                // already closed
            }
            void subscriber.quit();
        });
        await subscriber.subscribe(`user:${userId}`);
        // --- Inbound message loop -------------------------------------------------
        socket.on('message', (raw) => {
            void (async () => {
                let parsedJson;
                try {
                    parsedJson = JSON.parse(raw.toString('utf8'));
                }
                catch {
                    sendError(socket, 'Malformed JSON');
                    return;
                }
                const msg = clientMessageSchema.safeParse(parsedJson).success
                    ? clientMessageSchema.parse(parsedJson)
                    : null;
                if (!msg) {
                    sendError(socket, 'Invalid message');
                    return;
                }
                switch (msg.type) {
                    case wsClientEvents.PRESENCE_PING: {
                        await setPresence(request.server.redis, userId, msg.matchId);
                        send(socket, { type: 'presence.ack', id: msg.id, ts: new Date().toISOString() });
                        break;
                    }
                    case wsClientEvents.QUEUE_SUBSCRIBE: {
                        // Only ever the caller's own channel; a requested target is ignored.
                        await subscriber.subscribe(`user:${userId}`);
                        send(socket, { type: 'queue.subscribed', id: msg.id, ts: new Date().toISOString() });
                        break;
                    }
                    case wsClientEvents.MATCH_SUBSCRIBE: {
                        if (!msg.matchId) {
                            sendError(socket, 'matchId required');
                            break;
                        }
                        const snapshot = await getMatchSnapshot(request.server.db, msg.matchId, userId);
                        if (snapshot) {
                            await subscriber.subscribe(`match:${msg.matchId}`);
                            send(socket, {
                                type: 'match.snapshot',
                                id: crypto.randomUUID(),
                                ts: new Date().toISOString(),
                                matchId: msg.matchId,
                                payload: { match: snapshot },
                            });
                            break;
                        }
                        // Observer path: authorization is derived ENTIRELY from the
                        // DB-backed session (role permission + server-recorded observation
                        // state). A client claiming "admin" without both is rejected.
                        if (hasPermission(user.role, 'admin.matches.inspect') &&
                            (await hasActiveObservation(request.server.db, msg.matchId, userId))) {
                            const inspection = await inspectMatch(request.server.db, msg.matchId);
                            await subscriber.subscribe(`match:${msg.matchId}`);
                            send(socket, {
                                type: 'observer.snapshot',
                                id: crypto.randomUUID(),
                                ts: new Date().toISOString(),
                                matchId: msg.matchId,
                                payload: { mode: 'admin_observer', observing: true, match: inspection },
                            });
                            break;
                        }
                        // getMatchSnapshot returns null for non-participants: authorization
                        // is derived from database state, not from the client claim.
                        sendError(socket, 'Not authorized for this match', 'FORBIDDEN');
                        break;
                    }
                    case wsClientEvents.MATCH_READY: {
                        if (!msg.matchId) {
                            sendError(socket, 'matchId required');
                            break;
                        }
                        try {
                            const result = await markReady(request.server.db, request.server.redis, {
                                matchId: msg.matchId,
                                userId,
                            });
                            send(socket, {
                                type: 'match.ready_ack',
                                id: msg.id ?? crypto.randomUUID(),
                                ts: new Date().toISOString(),
                                matchId: msg.matchId,
                                payload: result,
                            });
                        }
                        catch (err) {
                            request.log.warn({ err }, 'ws_match_ready_failed');
                            sendError(socket, 'Cannot ready up right now');
                        }
                        break;
                    }
                    case wsClientEvents.MATCH_RESYNC: {
                        if (!msg.matchId) {
                            sendError(socket, 'matchId required');
                            break;
                        }
                        const snapshot = await getMatchSnapshot(request.server.db, msg.matchId, userId);
                        let observerSnapshot = null;
                        if (!snapshot) {
                            if (hasPermission(user.role, 'admin.matches.inspect') &&
                                (await hasActiveObservation(request.server.db, msg.matchId, userId))) {
                                observerSnapshot = await inspectMatch(request.server.db, msg.matchId);
                            }
                            else {
                                sendError(socket, 'Not authorized for this match', 'FORBIDDEN');
                                break;
                            }
                        }
                        const events = await getMatchEventsSince(request.server.db, msg.matchId, msg.lastEventId);
                        const effectiveMatchId = msg.matchId;
                        if (effectiveMatchId === null)
                            break;
                        send(socket, {
                            type: snapshot ? 'match.snapshot' : 'observer.snapshot',
                            id: crypto.randomUUID(),
                            ts: new Date().toISOString(),
                            matchId: effectiveMatchId,
                            payload: snapshot
                                ? { match: snapshot, eventsSince: events.length }
                                : { mode: 'admin_observer', observing: true, match: observerSnapshot, eventsSince: events.length },
                        });
                        for (const event of events.slice(-50)) {
                            send(socket, {
                                type: event.eventType,
                                id: `evt-${event.id}`,
                                ts: event.createdAt.toISOString(),
                                matchId: msg.matchId,
                                payload: event.payload,
                            });
                        }
                        break;
                    }
                    default:
                        sendError(socket, 'Unknown message type');
                }
            })().catch((err) => {
                request.log.error({ err }, 'ws_message_handler_failed');
                sendError(socket, 'Internal error');
            });
        });
    });
}
//# sourceMappingURL=handler.js.map