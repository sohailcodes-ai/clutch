import type { DbExecutor } from '@clutch/db';
/**
 * Deterministic progression engine.
 *
 * No ML, no fake AI: recommendations follow transparent rules over persisted
 * per-question stats (attempts / solved / failed / best time) recorded from
 * SERVER-AUTHORITATIVE match outcomes only.
 */
export type TopicSignal = {
    topic: string;
    attempts: number;
    solved: number;
    failed: number;
    accuracy: number;
};
export type ProgressionDecision = {
    /** Band id the user should practice next ('rookie'...'clutch'). */
    targetBandId: string;
    /** Topics needing work (low accuracy), strongest weakness first. */
    weakTopics: string[];
    /** Topics performing well — safe to level up within them. */
    strongTopics: string[];
    reason: string;
};
/** Pure ladder helper: index of band id, or -1 if unknown. */
export declare function ladderIndex(bandId: string): number;
/**
 * Pure decision function — trivially unit-testable and deterministic.
 * Rules:
 * - Start every player at 'rookie'.
 * - If recent overall accuracy >= STRONG threshold (with enough signal),
 *   step up exactly one rung on the ladder.
 * - If recent accuracy <= WEAK threshold, step down one rung (floor rookie).
 * - Otherwise stay.
 */
export declare function decideProgression(signals: TopicSignal[], currentRating: number): ProgressionDecision;
/** Records a server-authoritative attempt outcome (called after evaluation). */
export declare function recordQuestionAttempt(db: DbExecutor, input: {
    userId: string;
    questionId: string;
    topic: string;
    difficultyId: string;
    passed: boolean;
    executionTimeMs?: number;
}): Promise<void>;
/**
 * Server-authoritative progression update after an evaluated submission.
 * Resolves the question's topic/difficulty and records the outcome.
 */
export declare function recordSubmissionOutcome(db: DbExecutor, submissionId: string): Promise<{
    userId: string;
    questionSlug: string;
    passed: boolean;
    status: "queued" | "received" | "running" | "accepted" | "wrong_answer" | "time_limit" | "runtime_error" | "compile_error" | "internal_error";
} | null>;
export declare function getUserProgress(db: DbExecutor, userId: string): Promise<{
    attempts: number;
    solved: number;
    accuracy: number;
    perQuestion: {
        slug: string;
        title: string;
        topic: string;
        difficultyId: string;
        attempts: number;
        solved: number;
        failed: number;
        bestTimeMs: number | null;
        lastAttemptAt: Date;
    }[];
}>;
export declare function getTopicSignals(db: DbExecutor, userId: string): Promise<TopicSignal[]>;
/**
 * Deterministic recommendation: pick published questions in the target band,
 * preferring weak topics, excluding recently-seen ones.
 */
export declare function recommendNextQuestions(db: DbExecutor, userId: string, stackId: string | undefined, limit?: number): Promise<{
    decision: ProgressionDecision;
    recommendations: {
        id: string;
        slug: string;
        title: string;
        topic: string;
        difficultyId: string;
    }[];
}>;
//# sourceMappingURL=service.d.ts.map