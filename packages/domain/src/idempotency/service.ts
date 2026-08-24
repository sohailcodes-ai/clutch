import { createHash } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { Database } from '@clutch/db'
import { schema } from '@clutch/db'
import { AppError, ErrorCodes } from '@clutch/shared'

export function buildIdempotencyKey(userId: string, route: string, clientKey: string) {
  return `${userId}:${route}:${clientKey}`
}

function hashRequest(body: unknown) {
  return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex')
}

const IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  )
}

/**
 * Executes `handler` at most once per (user, route, key).
 *
 * Concurrency: two requests with the same key may both pass the initial read.
 * Both run the handler, but only one insert wins; the loser reads the stored
 * response. The stored request hash guarantees a reused key with a different
 * payload is always rejected.
 */
export async function withIdempotency<T>(
  db: Database,
  input: {
    userId: string
    route: string
    idempotencyKey: string
    requestBody: unknown
    handler: () => Promise<{ statusCode: number; body: T }>
  },
): Promise<T> {
  const key = buildIdempotencyKey(input.userId, input.route, input.idempotencyKey)
  const reqHash = hashRequest(input.requestBody)

  const existing = await db.query.idempotencyRecords.findFirst({
    where: and(
      eq(schema.idempotencyRecords.key, key),
      gt(schema.idempotencyRecords.expiresAt, new Date()),
    ),
  })

  if (existing) {
    if (existing.requestHash !== reqHash) {
      throw new AppError(ErrorCodes.CONFLICT, 'Idempotency key reused with different payload', 409)
    }
    return existing.responseBody as T
  }

  const result = await input.handler()
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS)

  try {
    await db.insert(schema.idempotencyRecords).values({
      key,
      userId: input.userId,
      route: input.route,
      requestHash: reqHash,
      responseCode: result.statusCode,
      responseBody: result.body as Record<string, unknown>,
      expiresAt,
    })
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const winner = await db.query.idempotencyRecords.findFirst({
      where: and(
        eq(schema.idempotencyRecords.key, key),
        gt(schema.idempotencyRecords.expiresAt, new Date()),
      ),
    })
    if (!winner || winner.requestHash !== reqHash) {
      throw new AppError(ErrorCodes.CONFLICT, 'Idempotency key reused with different payload', 409)
    }
    return winner.responseBody as T
  }

  return result.body
}
