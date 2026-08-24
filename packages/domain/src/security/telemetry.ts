import { sql } from 'drizzle-orm'
import type { DbExecutor } from '@clutch/db'
import { schema } from '@clutch/db'
import { TELEMETRY_LIMITS } from '@clutch/shared'
import { createAbuseFlag } from '../audit.js'

/**
 * Anti-cheat editor telemetry.
 *
 * Clients report bounded paste/drop/copy/blur events. This data is NEVER
 * treated as proof of cheating on its own — it accumulates server-side and
 * only creates review flags when thresholds are exceeded, for human/automated
 * review alongside submission-similarity evidence.
 */

export type TelemetrySummary = {
  pasteCount: number
  dropCount: number
  copyCount: number
  blurCount: number
  focusCount: number
}

export async function recordEditorTelemetry(
  db: DbExecutor,
  input: {
    matchId: string
    userId: string
    events: { kind: 'paste' | 'drop' | 'copy' | 'blur' | 'focus'; atMs: number; length?: number }[]
  },
): Promise<TelemetrySummary> {
  // Hard bound regardless of schema validation (defence in depth).
  const events = input.events.slice(0, TELEMETRY_LIMITS.MAX_EVENTS_PER_BATCH)

  const delta = { pasteCount: 0, dropCount: 0, copyCount: 0, blurCount: 0, focusCount: 0 }
  for (const e of events) {
    if (e.kind === 'paste') delta.pasteCount += 1
    else if (e.kind === 'drop') delta.dropCount += 1
    else if (e.kind === 'copy') delta.copyCount += 1
    else if (e.kind === 'blur') delta.blurCount += 1
    else if (e.kind === 'focus') delta.focusCount += 1
  }

  await db
    .insert(schema.matchTelemetry)
    .values({ matchId: input.matchId, userId: input.userId, ...delta })
    .onConflictDoUpdate({
      target: [schema.matchTelemetry.matchId, schema.matchTelemetry.userId],
      set: {
        pasteCount: sql`${schema.matchTelemetry.pasteCount} + ${delta.pasteCount}`,
        dropCount: sql`${schema.matchTelemetry.dropCount} + ${delta.dropCount}`,
        copyCount: sql`${schema.matchTelemetry.copyCount} + ${delta.copyCount}`,
        blurCount: sql`${schema.matchTelemetry.blurCount} + ${delta.blurCount}`,
        focusCount: sql`${schema.matchTelemetry.focusCount} + ${delta.focusCount}`,
        updatedAt: new Date(),
      },
    })

  const totals = await db.query.matchTelemetry.findFirst({
    where: sql`${schema.matchTelemetry.matchId} = ${input.matchId} AND ${schema.matchTelemetry.userId} = ${input.userId}`,
  })
  const summary: TelemetrySummary = {
    pasteCount: totals?.pasteCount ?? delta.pasteCount,
    dropCount: totals?.dropCount ?? delta.dropCount,
    copyCount: totals?.copyCount ?? delta.copyCount,
    blurCount: totals?.blurCount ?? delta.blurCount,
    focusCount: totals?.focusCount ?? delta.focusCount,
  }

  // Paste/drop deterrence: repeated large pastes in a ranked match create a
  // low-severity review flag. It does NOT change match outcomes directly.
  if (
    summary.pasteCount > TELEMETRY_LIMITS.MAX_PASTE_COUNT ||
    summary.dropCount > TELEMETRY_LIMITS.MAX_DROP_COUNT
  ) {
    await createAbuseFlag(db, {
      userId: input.userId,
      matchId: input.matchId,
      flagType: 'excessive_paste',
      severity: 'low',
      evidence: summary as unknown as Record<string, unknown>,
    })
  }

  return summary
}
