import { z } from 'zod';
/**
 * Dashboard / PlayerCard DTO contracts. These describe the SHAPE the API
 * guarantees to players; serialization happens in the domain layer and never
 * includes email, session, security or internal identifiers.
 */
export declare const competitiveStatusSchema: z.ZodEnum<["unranked", "ranked"]>;
export declare const playerCardSchema: z.ZodObject<{
    handle: z.ZodString;
    displayName: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodString>;
    equippedTitle: z.ZodNullable<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        rarity: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        rarity: string;
    }, {
        code: string;
        name: string;
        rarity: string;
    }>>;
    /** Server-authoritative competitive state — never inferred client-side. */
    competitiveStatus: z.ZodEnum<["unranked", "ranked"]>;
    placementMatchesRequired: z.ZodNumber;
    placementMatchesCompleted: z.ZodNumber;
    placementRemaining: z.ZodNumber;
    /** Null while unranked: no fake rating/tier/rank may be displayed. */
    bestRating: z.ZodNumber;
    bestStackId: z.ZodNullable<z.ZodString>;
    tierId: z.ZodNullable<z.ZodString>;
    globalRank: z.ZodNullable<z.ZodNumber>;
    wins: z.ZodNumber;
    losses: z.ZodNumber;
    draws: z.ZodNumber;
    gamesPlayed: z.ZodNumber;
    peakRating: z.ZodNumber;
    winRate: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    equippedTitle: {
        code: string;
        name: string;
        rarity: string;
    } | null;
    competitiveStatus: "unranked" | "ranked";
    placementMatchesRequired: number;
    placementMatchesCompleted: number;
    placementRemaining: number;
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
}, {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    equippedTitle: {
        code: string;
        name: string;
        rarity: string;
    } | null;
    competitiveStatus: "unranked" | "ranked";
    placementMatchesRequired: number;
    placementMatchesCompleted: number;
    placementRemaining: number;
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
}>;
export type PlayerCard = z.infer<typeof playerCardSchema>;
export declare const recentMatchCardSchema: z.ZodObject<{
    matchPublicId: z.ZodString;
    opponentHandle: z.ZodNullable<z.ZodString>;
    opponentAvatarUrl: z.ZodNullable<z.ZodString>;
    result: z.ZodEnum<["win", "loss", "draw", "forfeit", "no_result"]>;
    ratingDelta: z.ZodNullable<z.ZodNumber>;
    stackId: z.ZodString;
    difficultyId: z.ZodString;
    durationSec: z.ZodNullable<z.ZodNumber>;
    resolvedAt: z.ZodNullable<z.ZodString>;
    ranked: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    ranked: boolean;
    matchPublicId: string;
    opponentHandle: string | null;
    opponentAvatarUrl: string | null;
    result: "win" | "loss" | "draw" | "forfeit" | "no_result";
    ratingDelta: number | null;
    stackId: string;
    difficultyId: string;
    durationSec: number | null;
    resolvedAt: string | null;
}, {
    ranked: boolean;
    matchPublicId: string;
    opponentHandle: string | null;
    opponentAvatarUrl: string | null;
    result: "win" | "loss" | "draw" | "forfeit" | "no_result";
    ratingDelta: number | null;
    stackId: string;
    difficultyId: string;
    durationSec: number | null;
    resolvedAt: string | null;
}>;
export type RecentMatchCard = z.infer<typeof recentMatchCardSchema>;
/**
 * Pure sanitizer for recent-match rows. Given a raw composite it returns only
 * the whitelisted public fields — private data (source code, hidden tests,
 * moderation flags, internal ids) can never leak because it is dropped here.
 */
export declare function sanitizeRecentMatch(input: {
    matchPublicId: string;
    opponentHandle: string | null;
    opponentAvatarUrl: string | null;
    result: 'win' | 'loss' | 'draw' | 'forfeit' | 'no_result';
    ratingDelta: number | null;
    stackId: string;
    difficultyId: string;
    durationSec: number | null;
    resolvedAt: Date | null;
    ranked: boolean;
}): RecentMatchCard;
//# sourceMappingURL=dashboard.d.ts.map