import type { Redis } from 'ioredis';
import type { Database } from '@clutch/db';
export declare function ratingBucket(rating: number): number;
export declare function expandedBand(baseBucket: number, waitSeconds: number): {
    min: number;
    max: number;
};
export declare function joinQueue(db: Database, redis: Redis, input: {
    userId: string;
    stackId: string;
    difficultyId?: string;
}): Promise<{
    id: string;
    status: "matched" | "cancelled" | "waiting" | "expired";
    userId: string;
    region: string;
    stackId: string;
    rating: number;
    seasonId: string;
    difficultyId: string | null;
    matchId: string | null;
    enqueuedAt: Date;
    matchedAt: Date | null;
}>;
export declare function leaveQueue(db: Database, redis: Redis, userId: string): Promise<{
    id: string;
    status: "matched" | "cancelled" | "waiting" | "expired";
    userId: string;
    region: string;
    stackId: string;
    rating: number;
    seasonId: string;
    difficultyId: string | null;
    matchId: string | null;
    enqueuedAt: Date;
    matchedAt: Date | null;
}>;
/**
 * Attempts to pair the two oldest compatible entries in a season/stack queue.
 *
 * Race safety:
 * 1. A per-queue Redis mutex (SET NX PX) serializes concurrent workers.
 * 2. Inside the critical section every candidate entry is RE-VERIFIED against
 *    PostgreSQL (still `waiting`, owner not in an active match). Redis is only
 *    coordination; the database decides who may be paired.
 * 3. Match creation, participants and queue-entry updates commit atomically.
 */
export declare function tryPairQueue(db: Database, redis: Redis, seasonId: string, stackId: string): Promise<{
    id: string;
    status: "active" | "queued" | "matched" | "starting" | "evaluating" | "resolved" | "cancelled" | "abandoned" | "draw";
    createdAt: Date;
    endsAt: Date | null;
    stackId: string;
    seasonId: string;
    difficultyId: string;
    timeLimitSec: number;
    version: number;
    questionVersionId: string;
    publicId: string;
    startedAt: Date | null;
    resolvedAt: Date | null;
    winnerUserId: string | null;
    resolveReason: string | null;
    ranked: boolean;
    roomId: string | null;
    eventId: string | null;
    tournamentId: string | null;
} | null>;
export declare function getQueueStatus(db: Database, userId: string): Promise<{
    id: string;
    status: "matched" | "cancelled" | "waiting" | "expired";
    userId: string;
    region: string;
    stackId: string;
    rating: number;
    seasonId: string;
    difficultyId: string | null;
    matchId: string | null;
    enqueuedAt: Date;
    matchedAt: Date | null;
} | undefined>;
//# sourceMappingURL=service.d.ts.map