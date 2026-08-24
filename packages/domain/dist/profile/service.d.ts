import type { Database } from '@clutch/db';
import { type UpdateProfileInput, type CompleteOnboardingInput } from '@clutch/shared';
export declare function updateProfile(db: Database, userId: string, input: UpdateProfileInput): Promise<{
    userId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    region: string;
    bio: string | null;
    equippedTitleId: string | null;
    onboardingCompletedAt: Date | null;
    primaryStackId: string | null;
    createdAt: Date;
    updatedAt: Date;
} | undefined>;
export declare function getUserRatings(db: Database, userId: string): Promise<{
    id: string;
    updatedAt: Date;
    userId: string;
    stackId: string;
    rating: number;
    tierId: string | null;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    placementRemaining: number;
    peakRating: number;
    lastPlayedAt: Date | null;
    stack: {
        symbol: string;
        id: string;
        name: string;
        judgeRuntime: string;
        isActive: boolean;
    };
    tier: {
        id: string;
        minRating: number;
        maxRating: number | null;
        sortOrder: number;
    } | null;
}[]>;
/** Public, safe-to-expose profile with competitive identity. */
export declare function getPublicProfile(db: Database, handle: string): Promise<{
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    region: string;
    bio: string | null;
    memberSince: Date;
    equippedTitle: {
        code: string;
        name: string;
        rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
    } | null;
    bestRating: number | null;
    bestStackId: string | null;
    tierId: string | null;
    titles: {
        code: string;
        name: string;
        kind: string;
        rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
        awardedAt: Date;
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
    }[];
} | null>;
export declare function listStacks(db: Database): Promise<{
    symbol: string;
    id: string;
    name: string;
    judgeRuntime: string;
    isActive: boolean;
}[]>;
/**
 * Marks first-time onboarding complete and records the preferred stack.
 * Competitive state (placements, ratings) is NOT touched here — it was
 * initialized by the registration service; this only stores the preference
 * and the server-authoritative completion marker.
 */
export declare function completeOnboarding(db: Database, userId: string, input: CompleteOnboardingInput): Promise<{
    userId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    region: string;
    bio: string | null;
    equippedTitleId: string | null;
    onboardingCompletedAt: Date | null;
    primaryStackId: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function getCurrentSeason(db: Database): Promise<{
    number: number;
    id: string;
    status: "active" | "upcoming" | "archived";
    name: string;
    title: string | null;
    startsAt: Date;
    endsAt: Date;
    softResetFactor: string;
    decayAfterDays: number;
    placementMatches: number;
} | undefined>;
//# sourceMappingURL=service.d.ts.map