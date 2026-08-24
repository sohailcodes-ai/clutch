import type { Redis } from 'ioredis';
export declare function userChannel(userId: string): string;
export declare function matchChannel(matchId: string): string;
export declare function publishUserEvent(redis: Redis, userId: string, event: {
    type: string;
    matchId?: string;
    payload?: Record<string, unknown>;
}): Promise<void>;
export declare function publishMatchEvent(redis: Redis, matchId: string, event: {
    type: string;
    payload?: Record<string, unknown>;
    actorUserId?: string;
}): Promise<void>;
export declare function setPresence(redis: Redis, userId: string, matchId?: string): Promise<void>;
export declare function getPresence(redis: Redis, userId: string): Promise<{
    matchId?: string;
    at: number;
} | null>;
//# sourceMappingURL=pubsub.d.ts.map