import type { FastifyInstance } from 'fastify';
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
export declare function registerWsRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=handler.d.ts.map