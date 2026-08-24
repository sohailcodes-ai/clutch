import { RATING_FLOOR } from '@clutch/shared';
export function getKFactor(gamesPlayed, placementRemaining, rating) {
    if (placementRemaining > 0)
        return 40;
    if (gamesPlayed < 30)
        return 32;
    if (rating > 2400)
        return 16;
    return 24;
}
export function expectedScore(ratingA, ratingB) {
    return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}
export function calculateRatingDelta(rating, opponentRating, actualScore, gamesPlayed, placementRemaining) {
    const k = getKFactor(gamesPlayed, placementRemaining, rating);
    const expected = expectedScore(rating, opponentRating);
    const delta = Math.round(k * (actualScore - expected));
    const after = Math.max(RATING_FLOOR, rating + delta);
    return { delta: after - rating, after, k, expected, actualScore };
}
export async function resolveTierId(db, rating) {
    const tiers = await db.query.rankTiers.findMany();
    const tier = tiers.find((t) => rating >= t.minRating && (t.maxRating === null || rating <= t.maxRating));
    return tier?.id ?? 'bronze';
}
export function scoreFromResult(result) {
    if (result === 'win')
        return 1;
    if (result === 'draw')
        return 0.5;
    return 0;
}
//# sourceMappingURL=elo.js.map