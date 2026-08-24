import type { Database } from '@clutch/db';
export declare function listLiveMatches(db: Database, limit?: number): Promise<{
    publicId: string;
    stackId: string;
    stackName: string;
    difficultyId: string;
    status: "active" | "queued" | "matched" | "starting" | "evaluating" | "resolved" | "cancelled" | "abandoned" | "draw";
    ranked: boolean;
    timeLimitSec: number;
    startedAt: string | null;
    endsAt: string | null;
    serverTimeMs: number;
    players: {
        handle: string;
        avatarUrl: string | null;
        slot: number;
    }[];
}[]>;
/** Recent resolved results for the Explore feed. */
export declare function listRecentResults(db: Database, limit?: number): Promise<{
    publicId: string;
    stackId: string;
    stackName: string;
    difficultyId: string;
    isDraw: boolean;
    winnerHandle: string | null;
    loserHandle: string | null;
    resolvedAt: string | null;
}[]>;
export type SpectatorSnapshot = Awaited<ReturnType<typeof getSpectatorSnapshot>>;
/**
 * Spectator view of a live match by PUBLIC id. Authorization model:
 * the match must exist; only whitelisted fields are returned. Submissions
 * (source code), hidden tests and telemetry are never included.
 */
export declare function getSpectatorSnapshot(db: Database, publicId: string): Promise<{
    publicId: string;
    status: "active" | "queued" | "matched" | "starting" | "evaluating" | "resolved" | "cancelled" | "abandoned" | "draw";
    stackId: string;
    stackName: string;
    difficultyId: string;
    question: {
        title: string;
        promptMd: string;
        examples: unknown;
        starterCode: unknown;
        /** Only PUBLIC test shapes are ever shown to spectators. */
        publicTestCount: number;
    };
    timeLimitSec: number;
    startedAt: string | null;
    endsAt: string | null;
    serverTimeMs: number;
    participants: {
        handle: string;
        avatarUrl: string | null;
        passedCount: number;
        totalWeight: number;
        attempts: number;
    }[];
} | null>;
//# sourceMappingURL=service.d.ts.map