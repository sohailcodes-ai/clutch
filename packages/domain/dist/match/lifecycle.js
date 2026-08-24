import { and, eq } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { AppError, ErrorCodes, MATCH_TIME_LIMIT_SEC, READY_WINDOW_SEC, } from '@clutch/shared';
import { buildCompetitiveIdentity } from '../rating/placement.js';
import { appendMatchEvent } from './events.js';
import { publishMatchEvent } from '../realtime/pubsub.js';
async function getParticipant(db, matchId, userId) {
    return db.query.matchParticipants.findFirst({
        where: and(eq(schema.matchParticipants.matchId, matchId), eq(schema.matchParticipants.userId, userId)),
    });
}
export async function getMatchSnapshot(db, matchId, viewerUserId) {
    const match = await db.query.matches.findFirst({
        where: eq(schema.matches.id, matchId),
        with: {
            participants: { with: { user: { with: { profile: true } } } },
            questionVersion: { with: { question: true, testCases: true } },
            submissions: true,
        },
    });
    if (!match)
        return null;
    const viewerIsParticipant = match.participants.some((p) => p.userId === viewerUserId);
    if (!viewerIsParticipant)
        return null;
    const publicTests = match.questionVersion.testCases.filter((t) => t.visibility === 'public');
    // Never leak the opponent's source code to either client.
    const ownSubmissions = match.submissions.filter((s) => s.userId === viewerUserId);
    // Server-authoritative placement context for the viewer (result/lobby UI).
    const viewerRatingRow = await db.query.userStackRatings.findFirst({
        where: and(eq(schema.userStackRatings.userId, viewerUserId), eq(schema.userStackRatings.stackId, match.stackId)),
    });
    return {
        ...match,
        questionVersion: {
            ...match.questionVersion,
            testCases: publicTests,
        },
        submissions: ownSubmissions,
        opponent: match.participants.find((p) => p.userId !== viewerUserId),
        viewerCompetitive: viewerRatingRow
            ? buildCompetitiveIdentity(viewerRatingRow)
            : null,
    };
}
export async function markReady(db, redis, input) {
    const result = await db.transaction(async (tx) => {
        const match = await tx.query.matches.findFirst({ where: eq(schema.matches.id, input.matchId) });
        if (!match)
            throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
        if (!['matched', 'starting'].includes(match.status)) {
            throw new AppError(ErrorCodes.MATCH_NOT_ACTIVE, 'Match is not in ready phase', 409);
        }
        const participant = await getParticipant(tx, input.matchId, input.userId);
        if (!participant)
            throw new AppError(ErrorCodes.FORBIDDEN, 'Not a match participant', 403);
        await tx
            .update(schema.matchParticipants)
            .set({ readyAt: new Date() })
            .where(eq(schema.matchParticipants.id, participant.id));
        let startingAnnounced = false;
        if (match.status === 'matched') {
            const rows = await tx
                .update(schema.matches)
                .set({ status: 'starting', version: match.version + 1 })
                .where(and(eq(schema.matches.id, match.id), eq(schema.matches.version, match.version)))
                .returning({ id: schema.matches.id });
            if (rows.length > 0) {
                await appendMatchEvent(tx, {
                    matchId: match.id,
                    eventType: 'match.starting',
                    actorUserId: input.userId,
                    payload: { readyWindowSec: READY_WINDOW_SEC },
                });
                startingAnnounced = true;
            }
        }
        const participants = await tx.query.matchParticipants.findMany({
            where: eq(schema.matchParticipants.matchId, input.matchId),
        });
        const allReady = participants.length === 2 && participants.every((p) => p.readyAt);
        let activated = false;
        if (allReady) {
            const fresh = await tx.query.matches.findFirst({
                where: eq(schema.matches.id, input.matchId),
            });
            if (fresh && fresh.status === 'starting') {
                const startedAt = new Date();
                const endsAt = new Date(startedAt.getTime() + (fresh.timeLimitSec ?? MATCH_TIME_LIMIT_SEC) * 1000);
                const rows = await tx
                    .update(schema.matches)
                    .set({
                    status: 'active',
                    startedAt,
                    endsAt,
                    version: fresh.version + 1,
                })
                    .where(and(eq(schema.matches.id, fresh.id), eq(schema.matches.version, fresh.version)))
                    .returning({ id: schema.matches.id });
                if (rows.length > 0) {
                    await appendMatchEvent(tx, {
                        matchId: match.id,
                        eventType: 'match.active',
                        payload: { startedAt: startedAt.toISOString(), endsAt: endsAt.toISOString() },
                    });
                    activated = true;
                }
            }
        }
        return { ready: true, active: allReady, startingAnnounced, activated };
    });
    if (result.startingAnnounced) {
        await publishMatchEvent(redis, input.matchId, {
            type: 'match.starting',
            payload: { readyWindowSec: READY_WINDOW_SEC },
        });
    }
    if (result.activated) {
        await publishMatchEvent(redis, input.matchId, {
            type: 'match.active',
            payload: { serverNow: new Date().toISOString() },
        });
    }
    return { ready: result.ready, active: result.active };
}
export async function forfeitMatch(db, redis, input) {
    const outcome = await db.transaction(async (tx) => {
        const match = await tx.query.matches.findFirst({
            where: eq(schema.matches.id, input.matchId),
            with: { participants: true },
        });
        if (!match)
            throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
        if (!['starting', 'active'].includes(match.status)) {
            throw new AppError(ErrorCodes.MATCH_NOT_ACTIVE, 'Match cannot be forfeited now', 409);
        }
        // Authorization: only an actual participant may forfeit their own match.
        const self = match.participants.find((p) => p.userId === input.userId);
        if (!self)
            throw new AppError(ErrorCodes.FORBIDDEN, 'Not a match participant', 403);
        const winner = match.participants.find((p) => p.userId !== input.userId);
        if (!winner)
            throw new AppError(ErrorCodes.INTERNAL, 'Missing opponent', 500);
        const rows = await tx
            .update(schema.matches)
            .set({
            status: 'abandoned',
            winnerUserId: winner.userId,
            resolveReason: 'forfeit',
            version: match.version + 1,
        })
            .where(and(eq(schema.matches.id, match.id), eq(schema.matches.version, match.version)))
            .returning({ id: schema.matches.id });
        if (rows.length === 0) {
            throw new AppError(ErrorCodes.CONFLICT, 'Match state changed, retry', 409);
        }
        await appendMatchEvent(tx, {
            matchId: match.id,
            eventType: 'match.forfeit',
            actorUserId: input.userId,
            payload: { winnerUserId: winner.userId },
        });
        return { winnerUserId: winner.userId, reason: 'forfeit' };
    });
    await publishMatchEvent(redis, input.matchId, {
        type: 'match.participant_update',
        payload: { forfeitedBy: input.userId, winnerUserId: outcome.winnerUserId },
    });
    return outcome;
}
export async function userHasActiveMatch(db, userId) {
    const rows = await db.query.matchParticipants.findMany({
        where: eq(schema.matchParticipants.userId, userId),
        with: { match: true },
    });
    return rows.find((r) => ['matched', 'starting', 'active', 'evaluating'].includes(r.match.status));
}
//# sourceMappingURL=lifecycle.js.map