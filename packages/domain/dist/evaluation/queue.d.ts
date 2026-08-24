import { Queue } from 'bullmq';
/**
 * ============================================================================
 * INFRASTRUCTURE BOUNDARY — UNTRUSTED CODE EXECUTION
 * ============================================================================
 * Submitted source code is untrusted and MUST NEVER be executed inside the API
 * process, the web server, or the database process.
 *
 * The flow enforced by this boundary is:
 *
 *   API  ->  submission row (PostgreSQL, authoritative)
 *        ->  evaluation queue (BullMQ/Redis)
 *        ->  ISOLATED EVALUATION WORKER (separate `@clutch/worker` process)
 *        ->  SANDBOXED RUNTIME (network-disabled, resource-limited container)
 *        ->  results persisted to PostgreSQL
 *        ->  realtime event published to subscribers
 *
 * The queue in this module is a pure producer. It carries only submission IDs;
 * source code is never duplicated into Redis. The worker process owns
 * `evaluateSubmission` and must run each test case inside a sandbox. The current
 * reference implementation in `evaluation/runner.ts` does not execute submitted
 * code at all — it exists so the full lifecycle can be exercised end-to-end
 * until the sandbox runtime is deployed.
 * ============================================================================
 */
export declare const EVALUATION_QUEUE_NAME = "submission-evaluation";
export type EvaluationJobData = {
    submissionId: string;
};
type EvaluationQueueLike = Pick<Queue<EvaluationJobData>, 'add'>;
export declare function createEvaluationQueue(redisUrl: string): Queue<EvaluationJobData, any, string, EvaluationJobData, any, string>;
export declare function enqueueSubmissionEvaluation(queue: EvaluationQueueLike, submissionId: string): Promise<void>;
export {};
//# sourceMappingURL=queue.d.ts.map