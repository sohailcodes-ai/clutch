import 'dotenv/config';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { createDb } from '@clutch/db';
import { EVALUATION_QUEUE_NAME } from '@clutch/domain';
import type { EvaluationJobData } from '@clutch/domain';
declare module 'fastify' {
    interface FastifyInstance {
        db: ReturnType<typeof createDb>;
        redis: Redis;
        pub: Redis;
        evalQueue: Queue<EvaluationJobData>;
    }
}
export { EVALUATION_QUEUE_NAME };
//# sourceMappingURL=server.d.ts.map