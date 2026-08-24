import { and, desc, eq, gt, ne, sql } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { AppError, ErrorCodes } from '@clutch/shared';
import { writeAuditLog } from '../audit.js';
export function isTitleCriteria(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const c = value;
    switch (c.type) {
        case 'wins':
        case 'matches':
        case 'draws':
        case 'rating':
        case 'win_streak':
        case 'unique_solved':
        case 'stacks_won':
        case 'difficulty_climb':
        case 'top_rank':
        case 'fast_win':
        case 'first_blood_fast':
            return typeof c.value === 'number' && c.value >= 0;
        case 'first_blood':
        case 'comeback':
            return true;
        default:
            return false;
    }
}
export const EMPTY_FACTS = {
    wins: 0,
    losses: 0,
    draws: 0,
    matches: 0,
    peakRating: 0,
    firstBloods: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    uniqueSolved: 0,
    stacksWon: 0,
    difficultiesSolved: 0,
    globalRank: null,
    fastestWinMs: null,
    comebackWins: 0,
};
/** Pure criteria evaluation — unit-testable, deterministic. */
export function evaluateCriteria(criteria, facts) {
    switch (criteria.type) {
        case 'wins':
            return facts.wins >= criteria.value;
        case 'matches':
            return facts.matches >= criteria.value;
        case 'draws':
            return facts.draws >= criteria.value;
        case 'rating':
            return facts.peakRating >= criteria.value;
        case 'win_streak':
            return facts.bestWinStreak >= criteria.value;
        case 'unique_solved':
            return facts.uniqueSolved >= criteria.value;
        case 'stacks_won':
            return facts.stacksWon >= criteria.value;
        case 'difficulty_climb':
            return facts.difficultiesSolved >= criteria.value;
        case 'top_rank':
            return facts.globalRank !== null && facts.globalRank <= criteria.value;
        case 'fast_win':
            return facts.fastestWinMs !== null && facts.fastestWinMs <= criteria.value;
        case 'first_blood':
            return facts.firstBloods >= 1;
        case 'comeback':
            return facts.comebackWins >= 1;
        case 'first_blood_fast':
            return (facts.firstBloods >= 1 &&
                facts.fastestWinMs !== null &&
                facts.fastestWinMs <= criteria.value);
    }
}
/**
 * Deterministic progress toward a criteria threshold. Returns null for
 * boolean criteria that cannot express partial progress.
 */
export function titleProgress(criteria, facts) {
    const pick = (current, target) => target > 0 ? { current: Math.min(current, target), target } : null;
    switch (criteria.type) {
        case 'wins':
            return pick(facts.wins, criteria.value);
        case 'matches':
            return pick(facts.matches, criteria.value);
        case 'draws':
            return pick(facts.draws, criteria.value);
        case 'rating':
            return pick(facts.peakRating, criteria.value);
        case 'win_streak':
            return pick(facts.bestWinStreak, criteria.value);
        case 'unique_solved':
            return pick(facts.uniqueSolved, criteria.value);
        case 'stacks_won':
            return pick(facts.stacksWon, criteria.value);
        case 'difficulty_climb':
            return pick(facts.difficultiesSolved, criteria.value);
        case 'top_rank':
            return facts.globalRank !== null ? pick(facts.globalRank, criteria.value) : null;
        case 'fast_win':
            return facts.fastestWinMs !== null ? pick(facts.fastestWinMs, criteria.value) : null;
        default:
            return null;
    }
}
async function getGlobalRank(db, userId) {
    // Global rank: position of the player's BEST stack rating among every
    // player's best stack rating. Computed entirely server-side.
    const ratings = await db.query.userStackRatings.findMany({
        where: eq(schema.userStackRatings.userId, userId),
        columns: { rating: true },
    });
    if (ratings.length === 0)
        return null;
    const myBest = Math.max(...ratings.map((r) => r.rating));
    const betterRows = await db
        .select({ uid: schema.userStackRatings.userId })
        .from(schema.userStackRatings)
        .groupBy(schema.userStackRatings.userId)
        .having(gt(maxRatingExpr, myBest));
    return betterRows.length + 1;
}
const maxRatingExpr = sql `MAX(${schema.userStackRatings.rating})`;
export async function getCompetitiveFacts(db, userId) {
    const ratings = await db.query.userStackRatings.findMany({
        where: eq(schema.userStackRatings.userId, userId),
    });
    const participants = await db.query.matchParticipants.findMany({
        where: eq(schema.matchParticipants.userId, userId),
        with: { match: true },
    });
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let matchesPlayed = 0;
    let firstBloods = 0;
    let comebackWins = 0;
    let fastestWinMs = null;
    // Chronological walk over finished RATED matches for streak computation.
    // Unranked room matches never contribute to competitive achievements.
    const finished = participants
        .filter((p) => p.match.ranked && ['resolved', 'draw', 'abandoned'].includes(p.match.status))
        .sort((a, b) => (a.match.resolvedAt ?? a.match.createdAt).getTime() -
        (b.match.resolvedAt ?? b.match.createdAt).getTime());
    let runningStreak = 0;
    let bestStreak = 0;
    for (const p of finished) {
        const m = p.match;
        matchesPlayed += 1;
        if (m.winnerUserId === userId) {
            wins += 1;
            runningStreak += 1;
            bestStreak = Math.max(bestStreak, runningStreak);
            const myBest = await db.query.submissions.findFirst({
                where: and(eq(schema.submissions.matchId, m.id), eq(schema.submissions.userId, userId)),
                orderBy: desc(schema.submissions.passedCount),
            });
            if (myBest && myBest.isFinal && myBest.status === 'accepted') {
                if (myBest.executionTimeMs !== null) {
                    fastestWinMs =
                        fastestWinMs === null
                            ? myBest.executionTimeMs
                            : Math.min(fastestWinMs, myBest.executionTimeMs);
                }
                // Comeback: the winner had an earlier non-accepted attempt in the
                // match before landing the accepted one.
                const earlierFailed = await db.query.submissions.findFirst({
                    where: and(eq(schema.submissions.matchId, m.id), eq(schema.submissions.userId, userId), ne(schema.submissions.id, myBest.id), ne(schema.submissions.status, 'accepted')),
                });
                if (earlierFailed)
                    comebackWins += 1;
            }
            if (m.resolveReason === 'judged') {
                // First Blood: won a judged match where the opponent never got a
                // single accepted test run.
                const opponent = await db.query.matchParticipants.findFirst({
                    where: and(eq(schema.matchParticipants.matchId, m.id), ne(schema.matchParticipants.userId, userId)),
                });
                let opponentScored = false;
                if (opponent) {
                    const best = await db.query.submissions.findFirst({
                        where: and(eq(schema.submissions.matchId, m.id), eq(schema.submissions.userId, opponent.userId)),
                        orderBy: desc(schema.submissions.passedCount),
                    });
                    opponentScored = (best?.passedCount ?? 0) > 0;
                }
                if (!opponentScored)
                    firstBloods += 1;
            }
        }
        else if (m.winnerUserId && m.winnerUserId !== userId) {
            losses += 1;
            runningStreak = 0;
        }
        else {
            draws += 1;
        }
    }
    const [stats] = await db
        .select({
        uniqueSolved: sql `COUNT(DISTINCT ${schema.userQuestionStats.questionId})`,
        difficultiesSolved: sql `COUNT(DISTINCT ${schema.userQuestionStats.difficultyId})`,
    })
        .from(schema.userQuestionStats)
        .where(and(eq(schema.userQuestionStats.userId, userId), gt(schema.userQuestionStats.solved, 0)));
    const peakRating = ratings.reduce((max, r) => Math.max(max, r.peakRating), 0);
    const stacksWon = ratings.filter((r) => r.wins > 0).length;
    const globalRank = await getGlobalRank(db, userId);
    return {
        wins,
        losses,
        draws,
        matches: matchesPlayed,
        peakRating,
        firstBloods,
        currentWinStreak: runningStreak,
        bestWinStreak: bestStreak,
        uniqueSolved: Number(stats?.uniqueSolved ?? 0),
        stacksWon,
        difficultiesSolved: Number(stats?.difficultiesSolved ?? 0),
        globalRank,
        fastestWinMs,
        comebackWins,
    };
}
/**
 * Evaluates every active title against the user's facts and inserts any newly
 * earned ones. Idempotent via unique(user_id, title_id). Runs inside an
 * optional caller transaction.
 */
export async function evaluateAndAwardTitles(db, userId, matchId) {
    const activeTitles = await db.query.titles.findMany({
        where: eq(schema.titles.isActive, true),
    });
    if (activeTitles.length === 0)
        return [];
    const existing = await db.query.userTitles.findMany({
        where: eq(schema.userTitles.userId, userId),
    });
    const ownedIds = new Set(existing.map((t) => t.titleId));
    const facts = await getCompetitiveFacts(db, userId);
    const awarded = [];
    for (const title of activeTitles) {
        if (ownedIds.has(title.id))
            continue;
        const criteria = title.criteria;
        if (!isTitleCriteria(criteria))
            continue;
        if (!evaluateCriteria(criteria, facts))
            continue;
        await db
            .insert(schema.userTitles)
            .values({ userId, titleId: title.id, matchId: matchId ?? null })
            .onConflictDoNothing();
        await writeAuditLog(db, {
            actorUserId: userId,
            action: 'title.awarded',
            resourceType: 'title',
            resourceId: title.code,
            metadata: { matchId: matchId ?? null },
        });
        awarded.push({ code: title.code, name: title.name });
    }
    return awarded;
}
export async function getUserAwards(db, userId) {
    return db.query.userTitles.findMany({
        where: eq(schema.userTitles.userId, userId),
        with: { title: true },
        orderBy: (t, { asc }) => asc(t.titleId),
    });
}
export async function listActiveTitles(db) {
    return db.query.titles.findMany({
        where: and(eq(schema.titles.isActive, true)),
        orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.code)],
    });
}
/**
 * Full discovery view: every active title, unlocked state and progress toward
 * unlock. Secret titles that are still locked collapse to
 * "???" / "Secret Achievement" and hide their condition.
 */
export async function getTitleCatalogForUser(db, userId) {
    const [titles, awards, facts] = await Promise.all([
        listActiveTitles(db),
        getUserAwards(db, userId),
        getCompetitiveFacts(db, userId),
    ]);
    const ownedByCode = new Map(awards.map((a) => [a.title.code, a]));
    return titles.map((t) => {
        const owned = ownedByCode.get(t.code);
        const criteria = t.criteria;
        const valid = isTitleCriteria(criteria);
        if (owned) {
            return {
                code: t.code,
                name: t.name,
                description: t.description,
                rarity: t.rarity,
                kind: t.kind,
                icon: t.icon,
                unlocked: true,
                awardedAt: owned.awardedAt.toISOString(),
                isSecret: t.isSecret,
                progress: null,
            };
        }
        if (t.isSecret || !valid) {
            return {
                code: t.isSecret ? t.code : t.code,
                name: t.isSecret ? 'Secret Achievement' : t.name,
                description: t.isSecret ? '???' : t.description,
                rarity: t.rarity,
                kind: t.kind,
                icon: null,
                unlocked: false,
                awardedAt: null,
                isSecret: t.isSecret,
                progress: null,
            };
        }
        return {
            code: t.code,
            name: t.name,
            description: t.description,
            rarity: t.rarity,
            kind: t.kind,
            icon: t.icon,
            unlocked: false,
            awardedAt: null,
            isSecret: false,
            progress: titleProgress(criteria, facts),
        };
    });
}
/** Equip ONE owned title (or unequip with null). Server-side ownership check. */
export async function equipTitle(db, userId, titleCode) {
    if (titleCode === null) {
        await db
            .update(schema.userProfiles)
            .set({ equippedTitleId: null, updatedAt: new Date() })
            .where(eq(schema.userProfiles.userId, userId));
        return { equipped: null };
    }
    const title = await db.query.titles.findFirst({ where: eq(schema.titles.code, titleCode) });
    if (!title || !title.isActive) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Title not found', 404);
    }
    const award = await db.query.userTitles.findFirst({
        where: and(eq(schema.userTitles.userId, userId), eq(schema.userTitles.titleId, title.id)),
    });
    if (!award) {
        throw new AppError(ErrorCodes.FORBIDDEN, 'You have not unlocked this title', 403);
    }
    await db
        .update(schema.userProfiles)
        .set({ equippedTitleId: title.id, updatedAt: new Date() })
        .where(eq(schema.userProfiles.userId, userId));
    return {
        equipped: {
            code: title.code,
            name: title.name,
            description: title.description,
            rarity: title.rarity,
            kind: title.kind,
            icon: title.icon,
            unlocked: true,
            awardedAt: award.awardedAt.toISOString(),
            isSecret: title.isSecret,
            progress: null,
        },
    };
}
//# sourceMappingURL=service.js.map