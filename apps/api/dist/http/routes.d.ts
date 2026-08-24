import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { Database } from '@clutch/db';
export declare function resolveWhenReady(db: Database, redis: Redis, matchId: string): Promise<boolean>;
export declare function registerHttpRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=routes.d.ts.map