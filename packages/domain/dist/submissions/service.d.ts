import type { Redis } from 'ioredis';
import type { Database } from '@clutch/db';
export declare function createSubmission(db: Database, redis: Redis, input: {
    matchId: string;
    userId: string;
    sourceCode: string;
    idempotencyKey: string;
    isFinal?: boolean;
}): Promise<{
    id: string;
    status: "queued" | "received" | "running" | "accepted" | "wrong_answer" | "time_limit" | "runtime_error" | "compile_error" | "internal_error";
    createdAt: Date;
    userId: string;
    questionVersionId: string;
    matchId: string;
    sourceCode: string;
    language: string;
    passedCount: number;
    totalCount: number;
    executionTimeMs: number | null;
    memoryKb: number | null;
    isFinal: boolean;
    idempotencyKey: string;
} | {
    id: string;
    status: "queued" | "received" | "running" | "accepted" | "wrong_answer" | "time_limit" | "runtime_error" | "compile_error" | "internal_error";
    createdAt: Date;
    userId: string;
    questionVersionId: string;
    matchId: string;
    sourceCode: string;
    language: string;
    passedCount: number;
    totalCount: number;
    executionTimeMs: number | null;
    memoryKb: number | null;
    isFinal: boolean;
    idempotencyKey: string;
}>;
export declare function shouldEvaluateMatch(db: Database, matchId: string): Promise<boolean>;
export declare function markMatchEvaluating(db: Database, redis: Redis, matchId: string): Promise<true | null>;
//# sourceMappingURL=service.d.ts.map