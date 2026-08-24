import { and, count, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import { schema } from '@clutch/db';
const LEADERBOARD_MIN_GAMES = 5;
export async function getLeaderboard(db, stackId, limit = 50, offset = 0) {
    const rows = await db.query.userStackRatings.findMany({
        where: and(eq(schema.userStackRatings.stackId, stackId), gte(schema.userStackRatings.gamesPlayed, LEADERBOARD_MIN_GAMES)),
        with: { user: { with: { profile: true } } },
        orderBy: desc(schema.userStackRatings.rating),
        limit,
        offset,
    });
    const entries = rows
        .filter((r) => r.user.status === 'active')
        .map((row, index) => ({
        rank: offset + index + 1,
        userId: row.userId,
        handle: row.user.profile?.handle ?? 'unknown',
        displayName: row.user.profile?.displayName ?? null,
        avatarUrl: row.user.profile?.avatarUrl ?? null,
        stackId: row.stackId,
        rating: row.rating,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        tierId: row.tierId,
        percentile: null,
        titles: [],
    }));
    await enrichEntries(db, entries, stackId);
    return entries;
}
/** Fills percentile (vs full eligible board) and each player's top titles. */
async function enrichEntries(db, entries, stackId) {
    if (entries.length === 0)
        return;
    const [totalRow] = await db
        .select({ total: count() })
        .from(schema.userStackRatings)
        .innerJoin(schema.users, eq(schema.users.id, schema.userStackRatings.userId))
        .where(and(eq(schema.userStackRatings.stackId, stackId), gte(schema.userStackRatings.gamesPlayed, LEADERBOARD_MIN_GAMES), eq(schema.users.status, 'active')));
    const total = Number(totalRow?.total ?? 0);
    for (const e of entries) {
        e.percentile = total > 0 ? Math.round(((total - e.rank + 1) / total) * 10000) / 100 : null;
    }
    const userIds = entries.map((e) => e.userId);
    const awards = await db.query.userTitles.findMany({
        where: inArray(schema.userTitles.userId, userIds),
        with: { title: true },
    });
    for (const e of entries) {
        e.titles = awards
            .filter((a) => a.userId === e.userId)
            .slice(0, 3)
            .map((a) => ({ code: a.title.code, name: a.title.name }));
    }
}
export async function getUserRank(db, userId, stackId) {
    const ratingRow = await db.query.userStackRatings.findFirst({
        where: and(eq(schema.userStackRatings.userId, userId), eq(schema.userStackRatings.stackId, stackId)),
    });
    if (!ratingRow || ratingRow.gamesPlayed < LEADERBOARD_MIN_GAMES)
        return null;
    // Rank = number of eligible players strictly ahead of this rating, plus one.
    const aheadRows = await db
        .select({ ahead: count() })
        .from(schema.userStackRatings)
        .innerJoin(schema.users, eq(schema.users.id, schema.userStackRatings.userId))
        .where(and(eq(schema.userStackRatings.stackId, stackId), gt(schema.userStackRatings.rating, ratingRow.rating), gte(schema.userStackRatings.gamesPlayed, LEADERBOARD_MIN_GAMES), eq(schema.users.status, 'active')));
    const ahead = Number(aheadRows[0]?.ahead ?? 0);
    const profile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
    });
    return {
        rank: ahead + 1,
        userId,
        handle: profile?.handle ?? 'unknown',
        stackId,
        rating: ratingRow.rating,
        wins: ratingRow.wins,
        losses: ratingRow.losses,
        draws: ratingRow.draws,
        tierId: ratingRow.tierId,
    };
}
export async function refreshLeaderboardMaterialized(db) {
    // The materialized view is created by migrations; tolerate its absence in
    // environments that have not applied them yet.
    await db.execute(sql `REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_global`).catch(() => { });
}
//# sourceMappingURL=service.js.map