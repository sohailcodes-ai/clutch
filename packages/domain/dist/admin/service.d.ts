import type { Database, DbExecutor } from '@clutch/db';
export type SubmissionLike = {
    id: string;
    userId: string;
    status: string;
    passedCount: number;
    totalCount: number;
    executionTimeMs: number | null;
    isFinal: boolean;
    createdAt: Date;
};
/**
 * Admin submission view: status/progress only. Source code is deliberately
 * absent from the return type so it cannot leak into responses.
 */
export declare function redactSubmissionForAdmin(s: SubmissionLike): {
    id: string;
    userId: string;
    status: string;
    passedCount: number;
    totalCount: number;
    executionTimeMs: number | null;
    isFinal: boolean;
    createdAt: string;
};
export declare function getAdminOverview(db: DbExecutor): Promise<{
    serverTimeMs: number;
    questions: {
        published: number;
        drafts: number;
        archived: number;
    };
    queue: {
        stackId: string;
        waiting: number;
    }[];
    matches: {
        live: number;
        recent: {
            publicId: string;
            status: "active" | "queued" | "matched" | "starting" | "evaluating" | "resolved" | "cancelled" | "abandoned" | "draw";
            stackId: string;
            difficultyId: string;
            ranked: boolean;
            endsAt: string | null;
            players: {
                handle: string;
                avatarUrl: string | null;
            }[];
        }[];
    };
    events: {
        active: number;
        upcoming: number;
    };
    moderation: {
        pendingFlags: number;
    };
}>;
/** Live matches with per-participant submission state — no source code. */
export declare function listAdminMatches(db: Database, limit?: number): Promise<{
    id: string;
    publicId: string;
    status: "active" | "queued" | "matched" | "starting" | "evaluating" | "resolved" | "cancelled" | "abandoned" | "draw";
    phase: string;
    stackId: string;
    stackName: string;
    difficultyId: string;
    questionTitle: string;
    ranked: boolean;
    timeLimitSec: number;
    startedAt: string | null;
    endsAt: string | null;
    remainingSec: number | null;
    serverTimeMs: number;
    participants: {
        handle: string;
        avatarUrl: string | null;
        ratingBefore: number;
        submissionState: string;
        passedCount: number;
        attempts: number;
    }[];
}[]>;
/** Full inspection view for a single match. Read-only, code-free. */
export declare function inspectMatch(db: Database, matchId: string): Promise<{
    id: string;
    publicId: string;
    status: "active" | "queued" | "matched" | "starting" | "evaluating" | "resolved" | "cancelled" | "abandoned" | "draw";
    resolutionLabel: "draw" | "forfeit" | "admin_adjudication" | "automatic";
    stackName: string;
    difficultyId: string;
    questionTitle: string;
    seasonNumber: number;
    ranked: boolean;
    timeLimitSec: number;
    startedAt: string | null;
    endsAt: string | null;
    resolvedAt: string | null;
    winnerUserId: string | null;
    remainingSec: number | null;
    serverTimeMs: number;
    participants: {
        userId: string;
        handle: string;
        avatarUrl: string | null;
        slot: number;
        readyAt: string | null;
        ratingBefore: number;
        ratingAfter: number | null;
        tierId: string | null;
        result: "draw" | "win" | "loss" | "forfeit" | "no_result" | null;
        submissions: {
            id: string;
            userId: string;
            status: string;
            passedCount: number;
            totalCount: number;
            executionTimeMs: number | null;
            isFinal: boolean;
            createdAt: string;
        }[];
    }[];
    events: {
        id: number;
        type: string;
        actorUserId: string | null;
        payload: unknown;
        createdAt: string;
    }[];
}>;
/**
 * Server-generated observer lifecycle. The admin NEVER becomes a participant:
 * no participant row, no slot, no effect on matchmaking/ELO/timer. Only the
 * backend can emit these events — clients cannot forge admin.joined/admin.left.
 */
export declare function joinMatchAsObserver(db: Database, redis: import('ioredis').Redis, matchId: string, admin: {
    userId: string;
    handle: string | null;
}): Promise<{
    observing: boolean;
    alreadyObserving: boolean;
}>;
export declare function leaveMatchObservation(db: Database, redis: import('ioredis').Redis, matchId: string, admin: {
    userId: string;
    handle: string | null;
}): Promise<{
    observing: boolean;
}>;
/**
 * Server-side observation state: the admin's most recent observation event for
 * this match must be an un-closed join. Used to authorize WS observer
 * subscriptions without trusting any client claim.
 */
export declare function hasActiveObservation(db: DbExecutor, matchId: string, adminUserId: string): Promise<boolean>;
export declare function listAdminUsers(db: Database, query?: string, limit?: number): Promise<{
    userId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
    status: "active" | "suspended" | "banned";
    createdAt: string;
    bestRating: number | null;
    tierId: string | null;
    wins: number;
    losses: number;
    draws: number;
    gamesPlayed: number;
    peakRating: number;
}[]>;
/**
 * Detailed user inspection. Security-sensitive fields (recent session IPs)
 * are returned ONLY when the caller holds `admin.security.view` — the route
 * passes that decision in explicitly; it is never inferred here.
 */
export declare function inspectAdminUser(db: Database, userId: string, opts: {
    includeSecurity: boolean;
}): Promise<{
    userId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    region: string;
    role: string;
    status: "active" | "suspended" | "banned";
    emailVerified: boolean;
    memberSince: string;
    equippedTitle: {
        code: string;
        name: string;
    } | null;
    email: string | undefined;
    ratings: {
        stackId: string;
        rating: number;
        tierId: string | null;
        gamesPlayed: number;
        wins: number;
        losses: number;
        draws: number;
        peakRating: number;
    }[];
} | {
    security: {
        recentSessions: {
            ipAddress: string | null;
            userAgent: string | null;
            createdAt: string;
            expiresAt: string;
        }[];
    };
    userId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    region: string;
    role: string;
    status: "active" | "suspended" | "banned";
    emailVerified: boolean;
    memberSince: string;
    equippedTitle: {
        code: string;
        name: string;
    } | null;
    email: string | undefined;
    ratings: {
        stackId: string;
        rating: number;
        tierId: string | null;
        gamesPlayed: number;
        wins: number;
        losses: number;
        draws: number;
        peakRating: number;
    }[];
}>;
declare const ACCOUNT_STATUSES: readonly ["active", "suspended", "banned"];
export declare function setUserStatus(db: Database, adminUserId: string, userId: string, status: (typeof ACCOUNT_STATUSES)[number]): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    emailVerifiedAt: Date | null;
    status: "active" | "suspended" | "banned";
    role: string;
    createdAt: Date;
    updatedAt: Date;
} | undefined>;
export declare function listAuditLog(db: Database, opts: {
    action?: string;
    adminUserId?: string;
    limit: number;
    offset: number;
}): Promise<{
    id: number;
    action: string;
    actorHandle: string | null;
    resourceType: string;
    resourceId: string;
    metadata: unknown;
    createdAt: string;
}[]>;
export declare function listAbuseFlags(db: Database, status?: string, limit?: number): Promise<{
    id: string;
    flagType: string;
    severity: "low" | "medium" | "high";
    status: "open" | "reviewed" | "actioned" | "dismissed";
    matchPublicRef: string | null;
    userHandle: string | null;
    createdAt: string;
    evidenceSummary: {
        similarity: number | null;
    } | {
        similarity?: undefined;
    };
}[]>;
export declare function reviewAbuseFlag(db: Database, adminUserId: string, flagId: string, decision: 'reviewed' | 'actioned' | 'dismissed'): Promise<{
    id: string;
    userId: string;
    matchId: string | null;
    flagType: string;
    severity: "low" | "medium" | "high";
    evidence: unknown;
    status: "open" | "reviewed" | "actioned" | "dismissed";
    createdAt: Date;
} | undefined>;
export {};
//# sourceMappingURL=service.d.ts.map