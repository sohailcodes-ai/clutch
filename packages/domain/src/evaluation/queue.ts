import { Queue } from 'bullmq'

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
 * `evaluateSubmission` and runs each test case inside a sandboxed child process
 * (see `execution/sandbox.ts`). For production, the sandbox should be swapped
 * for Docker/Firecracker without changing domain logic.
 * ============================================================================
 */

export const EVALUATION_QUEUE_NAME = 'submission-evaluation'

export type EvaluationJobData = {
  submissionId: string
}

type EvaluationQueueLike = Pick<Queue<EvaluationJobData>, 'add'>

export function createEvaluationQueue(redisUrl: string) {
  const parsed = new URL(redisUrl)
  return new Queue<EvaluationJobData>(EVALUATION_QUEUE_NAME, {
    connection: {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      password: decodeURIComponent(parsed.password),
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      connectTimeout: 5000,
    },
    // Never let an evaluation job silently vanish; failed jobs are retried a
    // bounded number of times and then kept for inspection.
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: false,
    },
  })
}

export async function enqueueSubmissionEvaluation(
  queue: EvaluationQueueLike,
  submissionId: string,
) {
  // BullMQ forbids ':' in custom job ids.
  await queue.add('evaluate', { submissionId }, { jobId: `eval-${submissionId}` })
}
