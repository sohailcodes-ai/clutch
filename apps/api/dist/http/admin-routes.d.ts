import type { FastifyInstance } from 'fastify';
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
export declare function registerAdminRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=admin-routes.d.ts.map