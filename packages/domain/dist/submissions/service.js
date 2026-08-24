import { and, desc, eq } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { AppError, ErrorCodes, MAX_CODE_SIZE_BYTES } from '@clutch/shared';
import { appendMatchEvent } from '../match/events.js';
import { publishMatchEvent, publishUserEvent } from '../realtime/pubsub.js';
const ACTIVE_MATCH_STATUSES = ['matched', 'starting', 'active', 'evaluating'];
export async function createSubmission(db, redis, input) {
    if (Buffer.byteLength(input.sourceCode, 'utf8') > MAX_CODE_SIZE_BYTES) {
        throw new AppError(ErrorCodes.VALIDATION, 'Source code too large', 400);
    }
    const outcome = await db.transaction(async (tx) => {
        const match = await tx.query.matches.findFirst({ where: eq(schema.matches.id, input.matchId) });
        if (!match)
            throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found', 404);
        if (match.status !== 'active') {
            throw new AppError(ErrorCodes.MATCH_NOT_ACTIVE, 'Match is not active', 409);
        }
        const participant = await tx.query.matchParticipants.findFirst({
            where: and(eq(schema.matchParticipants.matchId, input.matchId), eq(schema.matchParticipants.userId, input.userId)),
        });
        if (!participant)
            throw new AppError(ErrorCodes.FORBIDDEN, 'Not a match participant', 403);
        const [created] = await tx
            .insert(schema.submissions)
            .values({
            matchId: input.matchId,
            userId: input.userId,
            questionVersionId: match.questionVersionId,
            sourceCode: input.sourceCode,
            language: match.stackId,
            status: 'queued',
            isFinal: input.isFinal ?? true,
            idempotencyKey: input.idempotencyKey,
        })
            // The unique constraint on (match_id, user_id, idempotency_key) makes a
            // concurrent duplicate insert impossible; the loser reads the winner.
            .onConflictDoNothing()
            .returning();
        if (created) {
            await appendMatchEvent(tx, {
                matchId: input.matchId,
                eventType: 'submission.queued',
                actorUserId: input.userId,
                payload: { submissionId: created.id },
            });
            return { created: true, submission: created };
        }
        const existing = await tx.query.submissions.findFirst({
            where: and(eq(schema.submissions.matchId, input.matchId), eq(schema.submissions.userId, input.userId), eq(schema.submissions.idempotencyKey, input.idempotencyKey)),
        });
        if (!existing)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create submission', 500);
        return { created: false, submission: existing };
    });
    // Only publish realtime events for genuinely new submissions; replays return
    // the original row silently so clients can safely retry.
    if (outcome.created) {
        await publishUserEvent(redis, input.userId, {
            type: 'submission.queued',
            matchId: input.matchId,
            payload: { submissionId: outcome.submission.id },
        });
    }
    return outcome.submission;
}
const EVALUATED_STATUSES = [
    'accepted',
    'wrong_answer',
    'time_limit',
    'runtime_error',
    'compile_error',
    'internal_error',
];
export async function shouldEvaluateMatch(db, matchId) {
    const match = await db.query.matches.findFirst({
        where: eq(schema.matches.id, matchId),
        with: { participants: true },
    });
    if (!match || !ACTIVE_MATCH_STATUSES.includes(match.status))
        return false;
    if (match.endsAt && match.endsAt <= new Date())
        return true;
    const finals = await Promise.all(match.participants.map(async (p) => {
        const sub = await db.query.submissions.findFirst({
            where: and(eq(schema.submissions.matchId, matchId), eq(schema.submissions.userId, p.userId), eq(schema.submissions.isFinal, true)),
            orderBy: desc(schema.submissions.createdAt),
        });
        // A final submission only counts once the evaluator has processed it;
        // otherwise an in-flight submission would trigger premature resolution.
        return sub && EVALUATED_STATUSES.includes(sub.status) ? sub : null;
    }));
    return finals.every(Boolean);
}
export async function markMatchEvaluating(db, redis, matchId) {
    const updated = await db.transaction(async (tx) => {
        const match = await tx.query.matches.findFirst({ where: eq(schema.matches.id, matchId) });
        if (!match || match.status !== 'active')
            return null;
        const rows = await tx
            .update(schema.matches)
            .set({ status: 'evaluating', version: match.version + 1 })
            .where(and(eq(schema.matches.id, matchId), eq(schema.matches.version, match.version)))
            .returning({ id: schema.matches.id });
        if (rows.length === 0)
            return null;
        await appendMatchEvent(tx, { matchId, eventType: 'match.evaluating' });
        return true;
    });
    if (updated) {
        await publishMatchEvent(redis, matchId, { type: 'match.evaluating' });
    }
    return updated;
}
//# sourceMappingURL=service.js.map