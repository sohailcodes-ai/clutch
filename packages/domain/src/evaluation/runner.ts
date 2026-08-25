import { eq } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import type { SubmissionStatus } from '@clutch/shared'
import { execute, type SandboxResult } from '../execution/index.js'

/**
 * ============================================================================
 * SUBMISSION EVALUATOR — SERVER-AUTHORITATIVE
 * ============================================================================
 * Evaluates a submission by executing its source code against every test case
 * inside a sandboxed environment. Each test case is run independently with
 * its own stdin. Results are persisted per-test-case and aggregated into the
 * submission's final status.
 *
 * SECURITY:
 * - Source code is NEVER executed inside the API process
 * - The sandbox enforces CPU timeout, output size limits, and filesystem isolation
 * - Environment variables are stripped; no application secrets are visible
 * - This function is called exclusively by the evaluation worker
 *
 * The `execute` function is a factory that dispatches to either a child_process
 * executor (development) or a Docker container executor (production), depending
 * on the SANDBOX_MODE environment variable.
 * ============================================================================
 */
export async function evaluateSubmission(
  db: Database,
  submissionId: string,
  onRunComplete?: (event: {
    submissionId: string
    matchId: string
    status: SubmissionStatus
    passedCount: number
    totalCount: number
  }) => void,
) {
  const submission = await db.query.submissions.findFirst({
    where: eq(schema.submissions.id, submissionId),
    with: { match: true },
  })
  if (!submission) return null

  const tests = await db.query.testCases.findMany({
    where: eq(schema.testCases.questionVersionId, submission.questionVersionId),
    orderBy: (fields, { asc }) => asc(fields.ordinal),
  })

  // Fetch the question's time/memory limits for per-test enforcement.
  const questionVersion = await db.query.questionVersions.findFirst({
    where: eq(schema.questionVersions.id, submission.questionVersionId),
    with: { question: true },
  })
  const timeLimitMs = (questionVersion?.question.timeLimitSec ?? 10) * 1000
  const memoryLimitMb = questionVersion?.question.memoryLimitMb ?? 256

  await db
    .update(schema.submissions)
    .set({ status: 'running', totalCount: tests.length })
    .where(eq(schema.submissions.id, submissionId))

  let passed = 0
  let totalTime = 0
  let earlyExit: SubmissionStatus | null = null

  for (const test of tests) {
    const result = await execute({
      sourceCode: submission.sourceCode,
      stackId: submission.language,
      stdin: test.input,
      timeLimitMs: Math.min(timeLimitMs, 10_000),
      memoryLimitMb,
    })

    const elapsed = result.executionTimeMs
    totalTime += elapsed

    const ok = result.stdout.trim() === test.expectedOutput.trim()
    let runStatus: SubmissionStatus
    if (ok) {
      runStatus = 'accepted'
      passed += test.weight
    } else {
      runStatus = mapSandboxStatus(result)
    }

    await db.insert(schema.submissionRuns).values({
      submissionId,
      testCaseId: test.id,
      status: runStatus,
      stdout: result.stdout,
      stderr: result.stderr,
      executionTimeMs: elapsed,
      memoryKb: result.memoryExceeded ? memoryLimitMb * 1024 : null,
    })

    await db
      .update(schema.submissions)
      .set({ passedCount: passed, status: runStatus })
      .where(eq(schema.submissions.id, submissionId))

    // Notify caller of per-submission progress (for realtime events).
    onRunComplete?.({
      submissionId,
      matchId: submission.matchId,
      status: runStatus,
      passedCount: passed,
      totalCount: tests.length,
    })

    // If the code failed to compile or crashed, no point running remaining tests.
    if (result.status === 'compile_error') {
      earlyExit = 'compile_error'
      break
    }
    if (result.status === 'internal_error') {
      earlyExit = 'internal_error'
      break
    }
  }

  let finalStatus: SubmissionStatus
  if (earlyExit) {
    finalStatus = earlyExit
  } else {
    const totalWeight = tests.reduce((sum, t) => sum + (t.weight ?? 1), 0)
    finalStatus = passed >= totalWeight ? 'accepted' : 'wrong_answer'
  }

  await db
    .update(schema.submissions)
    .set({
      status: finalStatus,
      passedCount: passed,
      executionTimeMs: totalTime,
    })
    .where(eq(schema.submissions.id, submissionId))

  return db.query.submissions.findFirst({ where: eq(schema.submissions.id, submissionId) })
}

/**
 * Execute source code against a single test case for the RUN endpoint.
 * Returns the raw sandbox result without persisting to the database.
 */
export async function runCode(params: {
  sourceCode: string
  stackId: string
  stdin: string
  timeLimitMs?: number
  memoryLimitMb?: number
}): Promise<SandboxResult> {
  return execute(params)
}

function mapSandboxStatus(result: SandboxResult): SubmissionStatus {
  switch (result.status) {
    case 'compile_error':
      return 'compile_error'
    case 'runtime_error':
      return 'runtime_error'
    case 'time_limit':
      return 'time_limit'
    case 'memory_limit':
      return 'runtime_error'
    case 'internal_error':
      return 'internal_error'
    default:
      return 'wrong_answer'
  }
}
