import { randomBytes } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { AppError, ErrorCodes, QUEUE_BAND_INITIAL, QUEUE_BAND_MAX, QUEUE_BAND_STEP, } from '@clutch/shared';
import { pairingInitialBand } from '../rating/placement.js';
import { selectQuestionForMatch } from '../questions/service.js';
import { appendMatchEvent } from '../match/events.js';
import { publishUserEvent } from '../realtime/pubsub.js';
const PAIR_LOCK_TTL_SEC = 10;
const ACTIVE_MATCH_STATUSES = ['matched', 'starting', 'active', 'evaluating'];
function queueKey(seasonId, stackId) {
    return `queue:${seasonId}:${stackId}`;
}
function queueMetaKey(entryId) {
    return `queue:meta:${entryId}`;
}
function pairLockKey(seasonId, stackId) {
    return `lock:pair:${seasonId}:${stackId}`;
}
function recentPairKey(a, b) {
    const sorted = [a, b].sort();
    return `recent_pair:${sorted[0]}:${sorted[1]}`;
}
export function ratingBucket(rating, bandSize = QUEUE_BAND_INITIAL) {
    return Math.floor(rating / bandSize) * bandSize;
}
export function expandedBand(baseBucket, waitSeconds, initialBand = QUEUE_BAND_INITIAL) {
    const expansions = Math.floor(waitSeconds / 10);
    const delta = Math.min(QUEUE_BAND_MAX, initialBand + expansions * QUEUE_BAND_STEP);
    return { min: baseBucket - delta, max: baseBucket + delta + QUEUE_BAND_INITIAL };
}
async function findActiveMatch(db, userId) {
    const rows = await db.query.matchParticipants.findMany({
        where: eq(schema.matchParticipants.userId, userId),
        with: { match: true },
    });
    return rows.find((row) => ACTIVE_MATCH_STATUSES.includes(row.match.status));
}
export async function joinQueue(db, redis, input) {
    const inActive = await findActiveMatch(db, input.userId);
    if (inActive) {
        throw new AppError(ErrorCodes.ALREADY_IN_MATCH, 'Already in an active match', 409);
    }
    const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.status, 'active') });
    if (!season)
        throw new AppError(ErrorCodes.INTERNAL, 'No active season', 500);
    const ratingRow = await db.query.userStackRatings.findFirst({
        where: and(eq(schema.userStackRatings.userId, input.userId), eq(schema.userStackRatings.stackId, input.stackId)),
    });
    if (!ratingRow)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Stack rating not found', 404);
    const profile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, input.userId),
    });
    if (!profile)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Profile not found', 404);
    const bucket = ratingBucket(ratingRow.rating);
    const score = Date.now();
    // The partial unique index on (user_id) WHERE status='waiting' makes a
    // concurrent double-join impossible at the database level; the pre-check is
    // only a fast path for the friendly error response.
    const [entry] = await db
        .insert(schema.queueEntries)
        .values({
        userId: input.userId,
        stackId: input.stackId,
        seasonId: season.id,
        rating: ratingRow.rating,
        region: profile.region,
        difficultyId: input.difficultyId,
        status: 'waiting',
    })
        .onConflictDoNothing()
        .returning();
    if (!entry) {
        throw new AppError(ErrorCodes.ALREADY_IN_QUEUE, 'Already in queue', 409);
    }
    const key = queueKey(season.id, input.stackId);
    await redis.zadd(key, score, entry.id);
    await redis.hset(queueMetaKey(entry.id), {
        userId: input.userId,
        rating: String(ratingRow.rating),
        bucket: String(bucket),
        region: profile.region,
        enqueuedAt: String(score),
        stackId: input.stackId,
        seasonId: season.id,
        // Placement context travels with the entry so the pairing policy can
        // widen the search for uncertain skill without extra DB round-trips.
        placementRemaining: String(ratingRow.placementRemaining),
    });
    await publishUserEvent(redis, input.userId, {
        type: 'queue.joined',
        payload: { entryId: entry.id, stackId: input.stackId, rating: ratingRow.rating },
    });
    return entry;
}
export async function leaveQueue(db, redis, userId) {
    const entry = await db.query.queueEntries.findFirst({
        where: and(eq(schema.queueEntries.userId, userId), eq(schema.queueEntries.status, 'waiting')),
    });
    if (!entry)
        throw new AppError(ErrorCodes.NOT_IN_QUEUE, 'Not in queue', 404);
    const cancelled = await db
        .update(schema.queueEntries)
        .set({ status: 'cancelled' })
        .where(and(eq(schema.queueEntries.id, entry.id), eq(schema.queueEntries.status, 'waiting')))
        .returning({ id: schema.queueEntries.id });
    // If a concurrent matcher already claimed this entry, don't corrupt Redis state.
    if (cancelled.length > 0) {
        await redis.zrem(queueKey(entry.seasonId, entry.stackId), entry.id);
        await redis.del(queueMetaKey(entry.id));
    }
    return entry;
}
function generatePublicId() {
    return `CL-${randomBytes(4).toString('hex').toUpperCase()}`;
}
/**
 * Attempts to pair the two oldest compatible entries in a season/stack queue.
 *
 * Race safety:
 * 1. A per-queue Redis mutex (SET NX PX) serializes concurrent workers.
 * 2. Inside the critical section every candidate entry is RE-VERIFIED against
 *    PostgreSQL (still `waiting`, owner not in an active match). Redis is only
 *    coordination; the database decides who may be paired.
 * 3. Match creation, participants and queue-entry updates commit atomically.
 */
export async function tryPairQueue(db, redis, seasonId, stackId) {
    const key = queueKey(seasonId, stackId);
    const lock = await redis.set(pairLockKey(seasonId, stackId), '1', 'PX', PAIR_LOCK_TTL_SEC * 1000, 'NX');
    if (lock !== 'OK')
        return null;
    try {
        const entryIds = await redis.zrange(key, 0, 49);
        if (entryIds.length < 2)
            return null;
        const metas = await Promise.all(entryIds.map(async (id) => {
            const meta = await redis.hgetall(queueMetaKey(id));
            return { id, ...meta };
        }));
        for (let i = 0; i < metas.length; i++) {
            for (let j = i + 1; j < metas.length; j++) {
                const a = metas[i];
                const b = metas[j];
                if (!a.userId || !b.userId || !a.rating || !b.rating || !a.enqueuedAt || !b.enqueuedAt)
                    continue;
                // Re-verify both entries against PostgreSQL before pairing.
                const freshEntries = await db.query.queueEntries.findMany({
                    where: and(inArray(schema.queueEntries.id, [a.id, b.id]), eq(schema.queueEntries.status, 'waiting')),
                });
                if (freshEntries.length !== 2)
                    continue;
                const activeMatchRows = await db.query.matchParticipants.findMany({
                    where: inArray(schema.matchParticipants.userId, [a.userId, b.userId]),
                    with: { match: true },
                });
                if (activeMatchRows.some((row) => ACTIVE_MATCH_STATUSES.includes(row.match.status))) {
                    continue;
                }
                const waitSeconds = (Date.now() - Number(a.enqueuedAt)) / 1000;
                // Placement-aware pairing policy: uncertain skill (either side still
                // in placement) starts with a wider — but bounded — search band, then
                // expands exactly like ranked matchmaking. Race protection, queue
                // uniqueness and the recent-pair guard are untouched.
                const placementRemainingA = Number(a.placementRemaining ?? 0);
                const placementRemainingB = Number(b.placementRemaining ?? 0);
                const involvesPlacement = placementRemainingA > 0 || placementRemainingB > 0;
                const band = expandedBand(ratingBucket(Number(a.rating)), waitSeconds, pairingInitialBand(involvesPlacement));
                const rb = Number(b.rating);
                if (rb < band.min || rb > band.max)
                    continue;
                const pairKey = recentPairKey(a.userId, b.userId);
                if (await redis.exists(pairKey))
                    continue;
                // Stack-aware + difficulty-preferred selection. A player queuing for
                // a specific stack/difficulty is only matched into compatible
                // questions; the selector itself falls back to nearby difficulties so
                // an empty bucket can never deadlock the queue.
                const entryA = freshEntries.find((e) => e.id === a.id);
                const entryB = freshEntries.find((e) => e.id === b.id);
                const sharedDifficulty = entryA?.difficultyId && entryA.difficultyId === entryB?.difficultyId
                    ? entryA.difficultyId
                    : null;
                const selected = await selectQuestionForMatch(db, stackId, (Number(a.rating) + rb) / 2, [a.userId, b.userId], {
                    preferredDifficultyId: sharedDifficulty,
                    // Placement matches start accessible and converge to adaptive:
                    // bias derives from the least-calibrated participant.
                    placementRemainingMin: Math.min(placementRemainingA, placementRemainingB),
                });
                if (!selected)
                    continue;
                const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.id, seasonId) });
                if (!season)
                    return null;
                const ratings = await db.query.userStackRatings.findMany({
                    where: and(inArray(schema.userStackRatings.userId, [a.userId, b.userId]), eq(schema.userStackRatings.stackId, stackId)),
                });
                const ratingA = ratings.find((r) => r.userId === a.userId)?.rating ?? 1000;
                const ratingB = ratings.find((r) => r.userId === b.userId)?.rating ?? 1000;
                const match = await db.transaction(async (tx) => {
                    const [created] = await tx
                        .insert(schema.matches)
                        .values({
                        publicId: generatePublicId(),
                        seasonId,
                        stackId,
                        questionVersionId: selected.version.id,
                        difficultyId: selected.difficultyId,
                        status: 'matched',
                        timeLimitSec: selected.question.timeLimitSec,
                    })
                        .returning();
                    if (!created)
                        throw new AppError(ErrorCodes.INTERNAL, 'Failed to create match', 500);
                    await tx.insert(schema.matchParticipants).values([
                        {
                            matchId: created.id,
                            userId: a.userId,
                            slot: 1,
                            ratingBefore: ratingA,
                        },
                        {
                            matchId: created.id,
                            userId: b.userId,
                            slot: 2,
                            ratingBefore: ratingB,
                        },
                    ]);
                    const claimed = await tx
                        .update(schema.queueEntries)
                        .set({ status: 'matched', matchedAt: new Date(), matchId: created.id })
                        .where(and(inArray(schema.queueEntries.id, [a.id, b.id]), eq(schema.queueEntries.status, 'waiting')))
                        .returning({ id: schema.queueEntries.id });
                    // Someone else claimed an entry between our verification and now;
                    // abort this pairing entirely.
                    if (claimed.length !== 2)
                        throw new AppError(ErrorCodes.CONFLICT, 'Queue entry changed', 409);
                    await appendMatchEvent(tx, {
                        matchId: created.id,
                        eventType: 'match.matched',
                        payload: { userIds: [a.userId, b.userId] },
                    });
                    return created;
                }).catch((err) => {
                    if (err instanceof AppError && err.code === ErrorCodes.CONFLICT)
                        return null;
                    throw err;
                });
                if (!match)
                    continue;
                await redis.zrem(key, a.id, b.id);
                await redis.del(queueMetaKey(a.id), queueMetaKey(b.id));
                await redis.setex(pairKey, 3600, '1');
                const questionMeta = {
                    title: selected.question.title,
                    promptMd: selected.version.promptMd,
                    starterCode: selected.version.starterCode,
                    timeLimitSec: match.timeLimitSec,
                };
                await publishUserEvent(redis, a.userId, {
                    type: 'match.found',
                    matchId: match.id,
                    payload: { matchId: match.id, publicId: match.publicId, opponentUserId: b.userId, questionMeta },
                });
                await publishUserEvent(redis, b.userId, {
                    type: 'match.found',
                    matchId: match.id,
                    payload: { matchId: match.id, publicId: match.publicId, opponentUserId: a.userId, questionMeta },
                });
                return match;
            }
        }
        return null;
    }
    finally {
        await redis.del(pairLockKey(seasonId, stackId));
    }
}
export async function getQueueStatus(db, userId) {
    return db.query.queueEntries.findFirst({
        where: and(eq(schema.queueEntries.userId, userId), eq(schema.queueEntries.status, 'waiting')),
    });
}
//# sourceMappingURL=service.js.map