import { ZodError } from 'zod';
import { AppError, hasPermission, isAdminRole } from '@clutch/shared';
import { getSessionUser } from '@clutch/domain';
const SESSION_COOKIE = 'clutch_session';
export async function requireAuth(request) {
    const token = request.cookies[SESSION_COOKIE] ??
        request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const user = await getSessionUser(request.server.db, token);
    if (!user) {
        throw new AppError('UNAUTHORIZED', 'Invalid session', 401);
    }
    request.user = user;
    request.sessionToken = token;
    // Read a client-supplied idempotency key header, if present and well-formed.
    const idem = request.headers['x-idempotency-key'];
    if (typeof idem === 'string' && idem.length >= 8 && idem.length <= 128) {
        request.idempotencyKey = idem;
    }
}
/**
 * Central error handler. Structured errors (AppError / validation) are
 * serialized safely; everything else is logged server-side and reduced to a
 * generic 500 so SQL errors, Redis internals, paths and secrets never leak.
 */
export async function handleError(error, request, reply) {
    if (error instanceof AppError) {
        void reply.code(error.statusCode);
        return {
            error: error.code,
            message: error.message,
            retryable: error.retryable,
        };
    }
    if (error instanceof ZodError) {
        void reply.code(400);
        return {
            error: 'VALIDATION',
            message: 'Invalid request',
            issues: error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })),
        };
    }
    // Fastify cookie parse failures and similar framework errors.
    if (typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number' &&
        error.statusCode < 500) {
        const status = error.statusCode;
        void reply.code(status);
        return { error: 'BAD_REQUEST', message: 'Malformed request' };
    }
    request.log.error({ err: error }, 'unhandled_error');
    void reply.code(500);
    return { error: 'INTERNAL', message: 'Internal server error' };
}
/**
 * Server-side admin gate. Must run AFTER requireAuth; the role is read from
 * the database-backed session user, never from a client claim. Accepts any
 * administrative role.
 */
export function requireAdmin(request) {
    if (!request.user || !isAdminRole(request.user.role)) {
        throw new AppError('FORBIDDEN', 'Administrator access required', 403);
    }
}
/**
 * Permission-scoped admin gate factory. Every privileged route declares the
 * exact permission it needs; the check runs against the DB-backed session
 * user's role via the shared permission matrix — server-side only.
 */
export function requirePermission(permission) {
    return function (request) {
        if (!request.user || !hasPermission(request.user.role, permission)) {
            throw new AppError('FORBIDDEN', 'Insufficient permissions', 403);
        }
    };
}
//# sourceMappingURL=auth.js.map