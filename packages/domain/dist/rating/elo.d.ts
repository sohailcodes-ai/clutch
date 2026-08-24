import type { DbExecutor } from '@clutch/db';
export declare function getKFactor(gamesPlayed: number, placementRemaining: number, rating: number): 32 | 24 | 40 | 16;
export declare function expectedScore(ratingA: number, ratingB: number): number;
export declare function calculateRatingDelta(rating: number, opponentRating: number, actualScore: number, gamesPlayed: number, placementRemaining: number): {
    delta: number;
    after: number;
    k: number;
    expected: number;
    actualScore: number;
};
export declare function resolveTierId(db: DbExecutor, rating: number): Promise<string>;
export declare function scoreFromResult(result: 'win' | 'loss' | 'draw' | 'forfeit' | 'no_result'): 1 | 0 | 0.5;
//# sourceMappingURL=elo.d.ts.map