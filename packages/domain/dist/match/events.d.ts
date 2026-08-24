import type { DbExecutor, Database } from '@clutch/db';
export declare function appendMatchEvent(db: DbExecutor, input: {
    matchId: string;
    eventType: string;
    actorUserId?: string;
    payload?: Record<string, unknown>;
}): Promise<{
    id: number;
    createdAt: Date;
    matchId: string;
    eventType: string;
    actorUserId: string | null;
    payload: unknown;
} | undefined>;
export declare function getMatchEventsSince(db: Database, matchId: string, lastEventId?: number): Promise<{
    id: number;
    createdAt: Date;
    matchId: string;
    eventType: string;
    actorUserId: string | null;
    payload: unknown;
}[]>;
//# sourceMappingURL=events.d.ts.map