import { schema } from '@clutch/db';
export async function writeAuditLog(db, input) {
    await db.insert(schema.auditLog).values({
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress,
    });
}
export async function createAbuseFlag(db, input) {
    await db.insert(schema.abuseFlags).values({
        userId: input.userId,
        matchId: input.matchId,
        flagType: input.flagType,
        severity: input.severity,
        evidence: input.evidence ?? {},
    });
}
//# sourceMappingURL=audit.js.map