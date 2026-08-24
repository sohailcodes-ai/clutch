import type { DbExecutor } from '@clutch/db'
import { schema } from '@clutch/db'

export async function writeAuditLog(
  db: DbExecutor,
  input: {
    actorUserId?: string
    action: string
    resourceType: string
    resourceId: string
    metadata?: Record<string, unknown>
    ipAddress?: string
  },
) {
  await db.insert(schema.auditLog).values({
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress,
  })
}

export async function createAbuseFlag(
  db: DbExecutor,
  input: {
    userId: string
    matchId?: string
    flagType: string
    severity: 'low' | 'medium' | 'high'
    evidence?: Record<string, unknown>
  },
) {
  await db.insert(schema.abuseFlags).values({
    userId: input.userId,
    matchId: input.matchId,
    flagType: input.flagType,
    severity: input.severity,
    evidence: input.evidence ?? {},
  })
}
