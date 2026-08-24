import type { Database } from '@clutch/db';
import { type PlayerCard, type RecentMatchCard } from '@clutch/shared';
/**
 * Player dashboard aggregation. Every value is derived server-side from the
 * authoritative rating system; DTOs are built through explicit sanitizers so
 * private fields (email, sessions, security data, source code) cannot leak.
 */
export declare function getPlayerCard(db: Database, userId: string): Promise<PlayerCard | null>;
export declare function computeGlobalRank(db: Database, userId: string): Promise<number | null>;
/**
 * Sanitized recent matches: opponent identity (handle/avatar only), result,
 * rating delta from the ledger, stack/difficulty, duration, time. No source
 * code, no hidden tests, no moderation data.
 */
export declare function getRecentMatches(db: Database, userId: string, limit?: number): Promise<RecentMatchCard[]>;
/** Full dashboard payload for the authenticated player's home page. */
export declare function getDashboard(db: Database, userId: string): Promise<{
    playerCard: {
        handle: string;
        displayName: string | null;
        avatarUrl: string | null;
        equippedTitle: {
            name: string;
            code: string;
            rarity: string;
        } | null;
        bestRating: number;
        bestStackId: string | null;
        tierId: string | null;
        globalRank: number | null;
        wins: number;
        losses: number;
        draws: number;
        gamesPlayed: number;
        peakRating: number;
        winRate: number;
    };
    recentMatches: {
        stackId: string;
        difficultyId: string;
        ranked: boolean;
        matchPublicId: string;
        opponentHandle: string | null;
        opponentAvatarUrl: string | null;
        result: "win" | "loss" | "draw" | "forfeit" | "no_result";
        ratingDelta: number | null;
        durationSec: number | null;
        resolvedAt: string | null;
    }[];
    ratings: {
        stackId: string;
        rating: number;
        tierId: string | null;
        gamesPlayed: number;
        wins: number;
        losses: number;
        draws: number;
        peakRating: number;
        placementRemaining: number;
    }[];
    serverTimeMs: number;
} | null>;
//# sourceMappingURL=service.d.ts.map