import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { DIFFICULTY_LADDER } from '@clutch/shared';
const MIN_ATTEMPTS_FOR_SIGNAL = 3;
const STRONG_ACCURACY = 0.7;
const WEAK_ACCURACY = 0.4;
/** Pure ladder helper: index of band id, or -1 if unknown. */
export function ladderIndex(bandId) {
    return DIFFICULTY_LADDER.findIndex((d) => d.id === bandId);
}
/**
 * Pure decision function — trivially unit-testable and deterministic.
 * Rules:
 * - Start every player at 'rookie'.
 * - If recent overall accuracy >= STRONG threshold (with enough signal),
 *   step up exactly one rung on the ladder.
 * - If recent accuracy <= WEAK threshold, step down one rung (floor rookie).
 * - Otherwise stay.
 */
export function decideProgression(signals, currentRating) {
    const totalAttempts = signals.reduce((s, x) => s + x.attempts, 0);
    const totalSolved = signals.reduce((s, x) => s + x.solved, 0);
    const sorted = [...signals].sort((a, b) => a.accuracy - b.accuracy);
    const weakTopics = sorted
        .filter((t) => t.attempts >= MIN_ATTEMPTS_FOR_SIGNAL && t.accuracy < WEAK_ACCURACY)
        .map((t) => t.topic);
    const strongTopics = sorted
        .filter((t) => t.attempts >= MIN_ATTEMPTS_FOR_SIGNAL && t.accuracy >= STRONG_ACCURACY)
        .map((t) => t.topic)
        .reverse();
    const ratingBand = DIFFICULTY_LADDER.find((d) => currentRating >= d.minRating && currentRating <= d.maxRating) ?? DIFFICULTY_LADDER[0];
    const overallAccuracy = totalAttempts > 0 ? totalSolved / totalAttempts : null;
    const idx = Math.max(0, ladderIndex(ratingBand.id));
    let targetIdx = idx;
    let reason = `Following your ${ratingBand.label} rating band`;
    if (overallAccuracy === null || totalAttempts < MIN_ATTEMPTS_FOR_SIGNAL) {
        targetIdx = 0;
        reason = 'New competitor — starting on Rookie foundations';
    }
    else if (overallAccuracy >= STRONG_ACCURACY && idx < DIFFICULTY_LADDER.length - 1) {
        targetIdx = idx + 1;
        reason = `${Math.round(overallAccuracy * 100)}% recent success — stepping up`;
    }
    else if (overallAccuracy < WEAK_ACCURACY && idx > 0) {
        targetIdx = idx - 1;
        reason = 'Recent struggles — consolidating fundamentals';
    }
    return {
        targetBandId: DIFFICULTY_LADDER[targetIdx].id,
        weakTopics,
        strongTopics,
        reason,
    };
}
/** Records a server-authoritative attempt outcome (called after evaluation). */
export async function recordQuestionAttempt(db, input) {
    await db
        .insert(schema.userQuestionStats)
        .values({
        userId: input.userId,
        questionId: input.questionId,
        topic: input.topic,
        difficultyId: input.difficultyId,
        attempts: 1,
        solved: input.passed ? 1 : 0,
        failed: input.passed ? 0 : 1,
        bestTimeMs: input.executionTimeMs ?? null,
        lastAttemptAt: new Date(),
    })
        .onConflictDoUpdate({
        target: [schema.userQuestionStats.userId, schema.userQuestionStats.questionId],
        set: {
            attempts: sql `${schema.userQuestionStats.attempts} + 1`,
            solved: sql `${schema.userQuestionStats.solved} + ${input.passed ? 1 : 0}`,
            failed: sql `${schema.userQuestionStats.failed} + ${input.passed ? 0 : 1}`,
            bestTimeMs: input.executionTimeMs
                ? sql `LEAST(COALESCE(${schema.userQuestionStats.bestTimeMs}, ${input.executionTimeMs}), ${input.executionTimeMs})`
                : sql `${schema.userQuestionStats.bestTimeMs}`,
            lastAttemptAt: new Date(),
        },
    });
}
/**
 * Server-authoritative progression update after an evaluated submission.
 * Resolves the question's topic/difficulty and records the outcome.
 */
export async function recordSubmissionOutcome(db, submissionId) {
    const submission = await db.query.submissions.findFirst({
        where: eq(schema.submissions.id, submissionId),
    });
    if (!submission)
        return null;
    const version = await db.query.questionVersions.findFirst({
        where: eq(schema.questionVersions.id, submission.questionVersionId),
        with: { question: true },
    });
    if (!version)
        return null;
    const passed = submission.status === 'accepted';
    await recordQuestionAttempt(db, {
        userId: submission.userId,
        questionId: version.question.id,
        topic: version.question.topic,
        difficultyId: version.question.difficultyId,
        passed,
        executionTimeMs: submission.executionTimeMs ?? undefined,
    });
    return {
        userId: submission.userId,
        questionSlug: version.question.slug,
        passed,
        status: submission.status,
    };
}
export async function getUserProgress(db, userId) {
    const rows = await db.query.userQuestionStats.findMany({
        where: eq(schema.userQuestionStats.userId, userId),
        with: { question: { columns: { slug: true, title: true, topic: true, difficultyId: true } } },
        orderBy: desc(schema.userQuestionStats.lastAttemptAt),
        limit: 100,
    });
    const attempts = rows.reduce((s, r) => s + r.attempts, 0);
    const solvedQuestions = new Set(rows.filter((r) => r.solved > 0).map((r) => r.questionId));
    return {
        attempts,
        solved: solvedQuestions.size,
        accuracy: attempts > 0 ? rows.reduce((s, r) => s + r.solved, 0) / attempts : 0,
        perQuestion: rows.map((r) => ({
            slug: r.question?.slug ?? 'unknown',
            title: r.question?.title ?? 'Unknown',
            topic: r.topic,
            difficultyId: r.difficultyId,
            attempts: r.attempts,
            solved: r.solved,
            failed: r.failed,
            bestTimeMs: r.bestTimeMs,
            lastAttemptAt: r.lastAttemptAt,
        })),
    };
}
export async function getTopicSignals(db, userId) {
    const rows = await db.query.userQuestionStats.findMany({
        where: eq(schema.userQuestionStats.userId, userId),
    });
    const byTopic = new Map();
    for (const r of rows) {
        const cur = byTopic.get(r.topic) ?? { topic: r.topic, attempts: 0, solved: 0, failed: 0, accuracy: 0 };
        cur.attempts += r.attempts;
        cur.solved += r.solved;
        cur.failed += r.failed;
        byTopic.set(r.topic, cur);
    }
    for (const t of byTopic.values()) {
        t.accuracy = t.attempts > 0 ? t.solved / t.attempts : 0;
    }
    return [...byTopic.values()];
}
/**
 * Deterministic recommendation: pick published questions in the target band,
 * preferring weak topics, excluding recently-seen ones.
 */
export async function recommendNextQuestions(db, userId, stackId, limit = 5) {
    const ratingRow = stackId
        ? await db.query.userStackRatings.findFirst({
            where: and(eq(schema.userStackRatings.userId, userId), eq(schema.userStackRatings.stackId, stackId)),
        })
        : undefined;
    const currentRating = ratingRow?.rating ?? 1000;
    const signals = await getTopicSignals(db, userId);
    const decision = decideProgression(signals, currentRating);
    const supported = stackId
        ? (await db.query.questionStackSupport.findMany({
            where: eq(schema.questionStackSupport.stackId, stackId),
        })).map((s) => s.questionId)
        : [];
    let candidates = await db.query.questions.findMany({
        where: and(eq(schema.questions.status, 'published'), eq(schema.questions.difficultyId, decision.targetBandId), supported.length > 0 ? inArray(schema.questions.id, supported) : undefined),
        limit: limit * 4,
    });
    if (candidates.length === 0) {
        // Never leave a player without content: fall back to the whole ladder below target.
        candidates = await db.query.questions.findMany({
            where: and(eq(schema.questions.status, 'published')),
            orderBy: desc(schema.questions.createdAt),
            limit: limit * 4,
        });
    }
    const seen = await db.query.userQuestionHistory.findMany({
        where: eq(schema.userQuestionHistory.userId, userId),
    });
    const seenIds = new Set(seen.map((h) => h.questionId));
    const ranked = [...candidates].sort((a, b) => {
        const weakA = decision.weakTopics.includes(a.topic) ? 0 : 1;
        const weakB = decision.weakTopics.includes(b.topic) ? 0 : 1;
        if (weakA !== weakB)
            return weakA - weakB;
        const freshA = seenIds.has(a.id) ? 1 : 0;
        const freshB = seenIds.has(b.id) ? 1 : 0;
        if (freshA !== freshB)
            return freshA - freshB;
        return a.slug.localeCompare(b.slug);
    });
    return {
        decision,
        recommendations: ranked.slice(0, limit).map((q) => ({
            id: q.id,
            slug: q.slug,
            title: q.title,
            topic: q.topic,
            difficultyId: q.difficultyId,
        })),
    };
}
//# sourceMappingURL=service.js.map