import type { Database } from '@clutch/db';
/** Reference evaluator: compares trimmed stdout to expected output. Swap for sandbox runner in production. */
export declare function evaluateSubmission(db: Database, submissionId: string): Promise<{
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
} | null | undefined>;
//# sourceMappingURL=runner.d.ts.map