import 'dotenv/config'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { eq, lte, and, inArray } from 'drizzle-orm'
import { createDb, schema } from '@clutch/db'
import {
  EVALUATION_QUEUE_NAME,
  detectSubmissionSimilarity,
  evaluateAndAwardTitles,
  evaluateSubmission,
  markMatchEvaluating,
  recordSubmissionOutcome,
  resolveMatch,
  shouldEvaluateMatch,
  tryPairQueue,
} from '@clutch/domain'

/**
 * ============================================================================
 * ISOLATED EVALUATION WORKER
 * ============================================================================
 * This process is the ONLY component allowed to touch submitted code. It runs
 * separately from the API, consumes the evaluation queue and must execute test
 * cases inside a sandboxed runtime (network-disabled, CPU/memory-capped,
 * ephemeral filesystem). The reference evaluator below does not execute code;
 * it exists so the lifecycle works end-to-end until the sandbox is wired in.
 * ============================================================================
 */

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL

if (!databaseUrl) throw new Error('DATABASE_URL is required')
if (!redisUrl) throw new Error('REDIS_URL is required')

const db = createDb(databaseUrl)
const redis = new Redis(redisUrl)

const SWEEP_INTERVAL_MS = 15_000
const PAIRING_INTERVAL_MS = 2_000

/**
 * Matchmaking loop: continuously attempts to pair waiting entries for every
 * active season x stack combination. tryPairQueue is race-safe (Redis mutex +
 * PostgreSQL re-verification), so overlapping ticks are harmless.
 */
async function sweepMatchmaking() {
  const seasons = await db.query.seasons.findMany({
    where: eq(schema.seasons.status, 'active'),
  })
  const stacks = await db.query.stacks.findMany({
    where: eq(schema.stacks.isActive, true),
  })

  for (const season of seasons) {
    for (const stack of stacks) {
      try {
        await tryPairQueue(db, redis, season.id, stack.id)
      } catch (err) {
        console.error({ err, seasonId: season.id, stackId: stack.id }, 'pairing_failed')
      }
    }
  }
}

async function resolveIfReady(matchId: string) {
  if (await shouldEvaluateMatch(db, matchId)) {
    await markMatchEvaluating(db, redis, matchId)
    const resolved = await resolveMatch(db, redis, matchId)
    if (resolved) {
      // Product layer (non-engine): award any newly earned titles to both
      // participants. Server-authoritative, idempotent, best-effort.
      for (const p of await db.query.matchParticipants.findMany({
        where: eq(schema.matchParticipants.matchId, matchId),
      })) {
        try {
          await evaluateAndAwardTitles(db, p.userId, matchId)
        } catch (err) {
          console.error({ err, userId: p.userId }, 'title_award_failed')
        }
      }
    }
    return resolved
  }
  return false
}

async function sweepExpiredMatches() {
  // Matches whose time window elapsed while active must be resolved even if a
  // participant disconnected. PostgreSQL is authoritative for expiry.
  const expired = await db.query.matches.findMany({
    where: and(
      inArray(schema.matches.status, ['active', 'starting']),
      lte(schema.matches.endsAt, new Date()),
    ),
    with: { participants: true },
  })

  for (const match of expired) {
    try {
      const stillActive = await markMatchEvaluating(db, redis, match.id)
      if (!stillActive) continue

      // A participant with no final submission forfeits; if neither submitted
      // or both did, resolution judges/draws on stored results.
      for (const p of match.participants) {
        const final = await db.query.submissions.findFirst({
          where: and(
            eq(schema.submissions.matchId, match.id),
            eq(schema.submissions.userId, p.userId),
            eq(schema.submissions.isFinal, true),
          ),
        })
        if (!final) {
          await db
            .update(schema.matches)
            .set({ status: 'abandoned', winnerUserId: null })
            .where(eq(schema.matches.id, match.id))
        }
      }

      await resolveMatch(db, redis, match.id)
    } catch (err) {
      console.error({ err, matchId: match.id }, 'sweep_resolution_failed')
    }
  }
}

const worker = new Worker(
  EVALUATION_QUEUE_NAME,
  async (job) => {
    const { submissionId } = job.data
    console.log({ submissionId, jobId: job.id }, 'evaluation_started')

    const result = await evaluateSubmission(db, submissionId)
    if (!result) {
      console.warn({ submissionId }, 'submission_not_found')
      return
    }

    await detectSubmissionSimilarity(db, result.matchId).catch((err) => {
      console.error({ err, matchId: result.matchId }, 'similarity_check_failed')
    })

    await resolveIfReady(result.matchId)

    // Progression tracking (non-engine): persist per-question attempt stats.
    try {
      await recordSubmissionOutcome(db, submissionId)
    } catch (err) {
      console.error({ err, submissionId }, 'progression_record_failed')
    }

    console.log({ submissionId, status: result.status }, 'evaluation_finished')
  },
  {
    connection: { url: redisUrl },
    concurrency: Number(process.env.EVALUATION_CONCURRENCY ?? 2),
  },
)

worker.on('failed', (job, err) => {
  console.error({ jobId: job?.id, err: err.message }, 'evaluation_job_failed')
})

const sweepTimer = setInterval(() => {
  sweepExpiredMatches().catch((err) => {
    console.error({ err }, 'sweep_failed')
  })
}, SWEEP_INTERVAL_MS)

const pairingTimer = setInterval(() => {
  sweepMatchmaking().catch((err) => {
    console.error({ err }, 'matchmaking_sweep_failed')
  })
}, PAIRING_INTERVAL_MS)

async function shutdown() {
  clearInterval(sweepTimer)
  clearInterval(pairingTimer)
  console.log('worker_shutting_down')
  await worker.close()
  redis.disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

console.log('evaluation_worker_started', { queue: EVALUATION_QUEUE_NAME })
