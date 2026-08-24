import type { DbExecutor } from '@clutch/db';
export declare function writeAuditLog(db: DbExecutor, input: {
    actorUserId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
}): Promise<void>;
export declare function createAbuseFlag(db: DbExecutor, input: {
    userId: string;
    matchId?: string;
    flagType: string;
    severity: 'low' | 'medium' | 'high';
    evidence?: Record<string, unknown>;
}): Promise<void>;
//# sourceMappingURL=audit.d.ts.map