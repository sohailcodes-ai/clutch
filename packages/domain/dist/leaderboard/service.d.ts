import type { Database } from '@clutch/db';
export declare function getLeaderboard(db: Database, stackId: string, limit?: number, offset?: number): Promise<{
    rank: number;
    userId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    stackId: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    tierId: string | null;
    percentile: number | null;
    titles: {
        code: string;
        name: string;
    }[];
}[]>;
export declare function getUserRank(db: Database, userId: string, stackId: string): Promise<{
    rank: number;
    userId: string;
    handle: string;
    stackId: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    tierId: string | null;
} | null>;
export declare function refreshLeaderboardMaterialized(db: Database): Promise<void>;
//# sourceMappingURL=service.d.ts.map