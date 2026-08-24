import type { FastifyReply, FastifyRequest } from 'fastify';
import { type AdminPermission } from '@clutch/shared';
import { getSessionUser } from '@clutch/domain';
export declare function requireAuth(request: FastifyRequest): Promise<void>;
/**
 * Central error handler. Structured errors (AppError / validation) are
 * serialized safely; everything else is logged server-side and reduced to a
 * generic 500 so SQL errors, Redis internals, paths and secrets never leak.
 */
export declare function handleError(error: unknown, request: FastifyRequest, reply: FastifyReply): Promise<{
    error: string;
    message: string;
    retryable: boolean;
    issues?: undefined;
} | {
    error: string;
    message: string;
    issues: {
        path: string;
        code: "invalid_type" | "invalid_literal" | "unrecognized_keys" | "invalid_union" | "invalid_union_discriminator" | "invalid_enum_value" | "invalid_arguments" | "invalid_return_type" | "invalid_date" | "invalid_string" | "too_small" | "too_big" | "invalid_intersection_types" | "not_multiple_of" | "not_finite" | "custom";
    }[];
    retryable?: undefined;
} | {
    error: string;
    message: string;
    retryable?: undefined;
    issues?: undefined;
}>;
/**
 * Server-side admin gate. Must run AFTER requireAuth; the role is read from
 * the database-backed session user, never from a client claim. Accepts any
 * administrative role.
 */
export declare function requireAdmin(request: FastifyRequest): void;
/**
 * Permission-scoped admin gate factory. Every privileged route declares the
 * exact permission it needs; the check runs against the DB-backed session
 * user's role via the shared permission matrix — server-side only.
 */
export declare function requirePermission(permission: AdminPermission): (request: FastifyRequest) => void;
declare module 'fastify' {
    interface FastifyRequest {
        user?: Awaited<ReturnType<typeof getSessionUser>>;
        sessionToken?: string;
        idempotencyKey?: string;
    }
}
//# sourceMappingURL=auth.d.ts.map