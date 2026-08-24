import type { Database } from '@clutch/db';
export declare function buildIdempotencyKey(userId: string, route: string, clientKey: string): string;
/**
 * Executes `handler` at most once per (user, route, key).
 *
 * Concurrency: two requests with the same key may both pass the initial read.
 * Both run the handler, but only one insert wins; the loser reads the stored
 * response. The stored request hash guarantees a reused key with a different
 * payload is always rejected.
 */
export declare function withIdempotency<T>(db: Database, input: {
    userId: string;
    route: string;
    idempotencyKey: string;
    requestBody: unknown;
    handler: () => Promise<{
        statusCode: number;
        body: T;
    }>;
}): Promise<T>;
//# sourceMappingURL=service.d.ts.map