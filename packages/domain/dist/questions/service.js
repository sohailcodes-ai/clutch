import { and, countDistinct, eq, inArray, sql } from 'drizzle-orm';
import { schema } from '@clutch/db';
import { AppError, ErrorCodes, } from '@clutch/shared';
// ---------------------------------------------------------------------------
// Pure selection primitives — unit-testable and deterministic
// ---------------------------------------------------------------------------
/** A question may only enter a match when published AND evaluable. */
export function isSelectableCandidate(q) {
    if (q.status !== 'published')
        return false;
    return q.versions.some((v) => v.testCases.length > 0);
}
/**
 * Band walk order for pool balancing: preferred band first, then adjacent
 * bands alternating outward (target-1, target+1, target-2, ...). Guarantees
 * matchmaking never deadlocks on an empty difficulty bucket while staying as
 * close to the requested difficulty as possible.
 */
export function bandWalkOrder(sortOrders, targetSortOrder) {
    const unique = [...new Set(sortOrders)].sort((a, b) => a - b);
    const lower = unique.filter((s) => s < targetSortOrder).reverse();
    const upper = unique.filter((s) => s > targetSortOrder);
    const order = [];
    if (unique.includes(targetSortOrder))
        order.push(targetSortOrder);
    const maxLen = Math.max(lower.length, upper.length);
    for (let i = 0; i < maxLen; i++) {
        const up = upper[i];
        const low = lower[i];
        if (up !== undefined)
            order.push(up);
        if (low !== undefined)
            order.push(low);
    }
    return order;
}
/**
 * Deterministic per-pair jitter. Same inputs always produce the same value,
 * but different pairs see different orderings so users cannot predict or
 * farm a fixed question queue. FNV-1a based, bounded to [0, 1).
 */
export function pairJitter(seedParts, slug) {
    let h = 0x811c9dc5;
    const s = [...seedParts, slug].join('\u0000');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) / 0x100000000;
}
/**
 * Scoring: prefer the target difficulty, penalize recently seen questions,
 * break ties with bounded pair-specific jitter. Higher score wins.
 */
export function scoreCandidate(c, jitterSeed) {
    const bandPenalty = Math.abs(c.bandSortOrder - c.targetSortOrder) * 10;
    const exposurePenalty = c.timesSeen * 3;
    const jitter = pairJitter(jitterSeed, c.slug); // [0,1) — tie-breaker only
    return 1000 - bandPenalty - exposurePenalty + jitter;
}
/** Deterministic winner selection from scored candidates. */
export function pickBest(pool, targetSortOrder, jitterSeed) {
    if (pool.length === 0)
        return null;
    let best = pool[0];
    let bestScore = scoreCandidate({ slug: best.slug, bandSortOrder: best.bandSortOrder, targetSortOrder, timesSeen: best.timesSeen }, jitterSeed);
    for (const c of pool.slice(1)) {
        const s = scoreCandidate({ slug: c.slug, bandSortOrder: c.bandSortOrder, targetSortOrder, timesSeen: c.timesSeen }, jitterSeed);
        if (s > bestScore) {
            best = c;
            bestScore = s;
        }
    }
    return best;
}
// ---------------------------------------------------------------------------
// Authoring lifecycle (admin) — published versions are IMMUTABLE
// ---------------------------------------------------------------------------
async function assertStacksExist(db, stackIds) {
    const rows = await db.select().from(schema.stacks).where(inArray(schema.stacks.id, stackIds));
    if (rows.length !== stackIds.length) {
        throw new AppError(ErrorCodes.VALIDATION, 'Unknown stack in stackIds', 400);
    }
}
async function assertBandExists(db, difficultyId) {
    const band = await db.query.difficultyBands.findFirst({
        where: eq(schema.difficultyBands.id, difficultyId),
    });
    if (!band)
        throw new AppError(ErrorCodes.VALIDATION, 'Unknown difficulty level', 400);
}
/** Creates an admin-owned DRAFT question with its initial (unpublished) v1. */
export async function createQuestionDraft(db, input) {
    await assertBandExists(db, input.difficultyId);
    await assertStacksExist(db, input.stackIds);
    return db.transaction(async (tx) => {
        const [q] = await tx
            .insert(schema.questions)
            .values({
            slug: input.slug,
            title: input.title,
            descriptionMd: input.descriptionMd ?? null,
            difficultyId: input.difficultyId,
            topic: input.topic,
            tags: input.tags,
            source: input.source,
            license: input.license ?? null,
            attribution: input.attribution ?? null,
            timeLimitSec: input.timeLimitSec,
            memoryLimitMb: input.memoryLimitMb,
            status: 'draft',
        })
            .returning();
        if (!q)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create question', 500);
        const [version] = await tx
            .insert(schema.questionVersions)
            .values({
            questionId: q.id,
            version: 1,
            promptMd: input.promptMd,
            examples: input.examples,
            starterCode: input.starterCode,
            publishedAt: null, // stamped on publish
        })
            .returning();
        if (!version)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create question version', 500);
        await tx
            .insert(schema.questionStackSupport)
            .values(input.stackIds.map((stackId) => ({ questionId: q.id, stackId })));
        await tx.insert(schema.testCases).values(input.testCases.map((test, index) => ({
            questionVersionId: version.id,
            ordinal: index + 1,
            visibility: test.visibility,
            input: test.input,
            expectedOutput: test.expectedOutput,
            weight: test.weight,
        })));
        return { question: q, version };
    });
}
/** Legacy direct-publish creation kept for compatibility with existing flows. */
export async function createQuestion(db, input) {
    await assertBandExists(db, input.difficultyId);
    await assertStacksExist(db, input.stackIds);
    return db.transaction(async (tx) => {
        const [q] = await tx
            .insert(schema.questions)
            .values({
            slug: input.slug,
            title: input.title,
            descriptionMd: input.descriptionMd ?? null,
            difficultyId: input.difficultyId,
            topic: input.topic,
            tags: input.tags,
            source: input.source,
            license: input.license ?? null,
            attribution: input.attribution ?? null,
            timeLimitSec: input.timeLimitSec,
            memoryLimitMb: input.memoryLimitMb,
            status: 'published',
        })
            .returning();
        if (!q)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create question', 500);
        const [version] = await tx
            .insert(schema.questionVersions)
            .values({
            questionId: q.id,
            version: 1,
            promptMd: input.promptMd,
            examples: input.examples,
            starterCode: input.starterCode,
            publishedAt: new Date(),
        })
            .returning();
        if (!version)
            throw new AppError(ErrorCodes.INTERNAL, 'Failed to create question version', 500);
        await tx
            .insert(schema.questionStackSupport)
            .values(input.stackIds.map((stackId) => ({ questionId: q.id, stackId })));
        await tx.insert(schema.testCases).values(input.testCases.map((test, index) => ({
            questionVersionId: version.id,
            ordinal: index + 1,
            visibility: test.visibility,
            input: test.input,
            expectedOutput: test.expectedOutput,
            weight: test.weight,
        })));
        return { question: q, version };
    });
}
async function loadQuestionOrThrow(db, questionId) {
    const q = await db.query.questions.findFirst({
        where: eq(schema.questions.id, questionId),
        with: { versions: true },
    });
    if (!q)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Question not found', 404);
    return q;
}
function latestVersion(versions) {
    return [...versions].sort((a, b) => a.version - b.version).at(-1);
}
/**
 * Update editable metadata. Content changes must go through
 * `upsertDraftContent`, which preserves the immutability of published
 * versions by creating a new version instead.
 */
export async function updateQuestionMeta(db, questionId, input) {
    const q = await loadQuestionOrThrow(db, questionId);
    if (input.difficultyId)
        await assertBandExists(db, input.difficultyId);
    if (input.stackIds)
        await assertStacksExist(db, input.stackIds);
    const [updated] = await db
        .update(schema.questions)
        .set({
        ...(input.title ? { title: input.title } : {}),
        ...(input.descriptionMd !== undefined ? { descriptionMd: input.descriptionMd } : {}),
        ...(input.difficultyId ? { difficultyId: input.difficultyId } : {}),
        ...(input.topic ? { topic: input.topic } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.timeLimitSec ? { timeLimitSec: input.timeLimitSec } : {}),
        ...(input.memoryLimitMb ? { memoryLimitMb: input.memoryLimitMb } : {}),
    })
        .where(eq(schema.questions.id, q.id))
        .returning();
    if (input.topicIds) {
        await db.delete(schema.questionTopics).where(eq(schema.questionTopics.questionId, q.id));
        if (input.topicIds.length > 0) {
            await db
                .insert(schema.questionTopics)
                .values(input.topicIds.map((topicId) => ({ questionId: q.id, topicId })));
        }
    }
    if (input.stackIds) {
        await db.delete(schema.questionStackSupport).where(eq(schema.questionStackSupport.questionId, q.id));
        await db
            .insert(schema.questionStackSupport)
            .values(input.stackIds.map((stackId) => ({ questionId: q.id, stackId })));
    }
    return updated;
}
/**
 * Content authoring. While a question is a DRAFT its latest version is edited
 * in place (it can never be referenced by a match). Once PUBLISHED, any
 * content change creates a NEW immutable version — active matches keep their
 * original version forever.
 */
export async function upsertDraftContent(db, questionId, content) {
    const q = await loadQuestionOrThrow(db, questionId);
    const latest = latestVersion(q.versions);
    if (!latest)
        throw new AppError(ErrorCodes.INTERNAL, 'Question has no versions', 500);
    if (q.status === 'draft') {
        const [updated] = await db
            .update(schema.questionVersions)
            .set({
            promptMd: content.promptMd,
            examples: content.examples,
            starterCode: content.starterCode,
            constraints: content.constraints,
        })
            .where(and(eq(schema.questionVersions.id, latest.id), sql `${schema.questionVersions.publishedAt} IS NULL`))
            .returning();
        if (!updated)
            throw new AppError(ErrorCodes.CONFLICT, 'Version already published', 409);
        return updated;
    }
    // Published/retired: immutable history — append version N+1.
    const nextVersionNumber = latest.version + 1;
    const [created] = await db
        .insert(schema.questionVersions)
        .values({
        questionId: q.id,
        version: nextVersionNumber,
        promptMd: content.promptMd,
        examples: content.examples,
        starterCode: content.starterCode,
        constraints: content.constraints,
        publishedAt: null,
    })
        .returning();
    if (!created)
        throw new AppError(ErrorCodes.INTERNAL, 'Failed to create version', 500);
    return created;
}
/** Adds test cases to the LATEST version. Rejected once that version is live
 *  in any match — hidden tests must be authored before publishing. */
export async function addTestCasesToLatestVersion(db, questionId, tests) {
    const q = await loadQuestionOrThrow(db, questionId);
    const latest = latestVersion(q.versions);
    if (!latest)
        throw new AppError(ErrorCodes.INTERNAL, 'Question has no versions', 500);
    if (latest.publishedAt && q.status === 'published') {
        // Allowed: appending tests to the live version would change what current
        // players are judged against. Force a new version instead.
        throw new AppError(ErrorCodes.CONFLICT, 'Cannot modify tests of a published version; create a new version', 409);
    }
    const maxOrdinal = (await db.query.testCases.findMany({
        where: eq(schema.testCases.questionVersionId, latest.id),
        orderBy: (t, { desc }) => desc(t.ordinal),
        limit: 1,
    }))[0]?.ordinal ?? 0;
    await db.insert(schema.testCases).values(tests.map((t, i) => ({
        questionVersionId: latest.id,
        ordinal: maxOrdinal + i + 1,
        visibility: t.visibility,
        input: t.input,
        expectedOutput: t.expectedOutput,
        weight: t.weight,
    })));
}
/** Draft/released transition. Publishing stamps the latest version. */
export async function publishQuestion(db, questionId) {
    const q = await loadQuestionOrThrow(db, questionId);
    const latest = latestVersion(q.versions);
    if (!latest)
        throw new AppError(ErrorCodes.INTERNAL, 'Question has no versions', 500);
    const tests = await db.query.testCases.findMany({
        where: eq(schema.testCases.questionVersionId, latest.id),
    });
    if (tests.length === 0) {
        throw new AppError(ErrorCodes.VALIDATION, 'Cannot publish without test cases', 400);
    }
    if (latest.publishedAt === null) {
        await db
            .update(schema.questionVersions)
            .set({ publishedAt: new Date() })
            .where(and(eq(schema.questionVersions.id, latest.id), sql `${schema.questionVersions.publishedAt} IS NULL`));
    }
    const [updated] = await db
        .update(schema.questions)
        .set({ status: 'published' })
        .where(eq(schema.questions.id, q.id))
        .returning();
    return updated;
}
export async function unpublishQuestion(db, questionId) {
    const [updated] = await db
        .update(schema.questions)
        .set({ status: 'draft' })
        .where(and(eq(schema.questions.id, questionId), neStatus('retired')))
        .returning();
    if (!updated)
        throw new AppError(ErrorCodes.CONFLICT, 'Question cannot be unpublished', 409);
    return updated;
}
export async function archiveQuestion(db, questionId) {
    // Archived ('retired') questions stay out of all future match selection;
    // historical matches keep referencing their frozen versions.
    const [updated] = await db
        .update(schema.questions)
        .set({ status: 'retired' })
        .where(eq(schema.questions.id, questionId))
        .returning();
    if (!updated)
        throw new AppError(ErrorCodes.NOT_FOUND, 'Question not found', 404);
    return updated;
}
function neStatus(status) {
    return sql `${schema.questions.status} <> ${status}`;
}
export async function listQuestionsForAdmin(db, opts) {
    const where = opts.status && opts.status !== 'all'
        ? eq(schema.questions.status, opts.status)
        : undefined;
    return db.query.questions.findMany({
        where,
        with: { versions: { columns: { id: true, version: true, publishedAt: true } }, stackSupport: true },
        orderBy: (q, { desc }) => desc(q.createdAt),
        limit: opts.limit,
        offset: opts.offset,
    });
}
/** Usage/pass-rate/solve-time analytics. Contains NO hidden test content. */
export async function getQuestionStats(db, questionId) {
    const versionRows = await db.query.questionVersions.findMany({
        where: eq(schema.questionVersions.questionId, questionId),
        columns: { id: true },
    });
    const versionIds = versionRows.map((v) => v.id);
    if (versionIds.length === 0) {
        return {
            timesUsedInMatches: 0,
            submissions: 0,
            acceptedSubmissions: 0,
            passRate: 0,
            averageSolveTimeMs: null,
            distinctSolvers: 0,
        };
    }
    const [matchUsage] = await db
        .select({ uses: countDistinct(schema.matches.id) })
        .from(schema.matches)
        .where(inArray(schema.matches.questionVersionId, versionIds));
    const [subStats] = await db
        .select({
        total: sql `COUNT(*)`,
        accepted: sql `COUNT(*) FILTER (WHERE ${schema.submissions.status} = 'accepted')`,
        avgMs: sql `AVG(${schema.submissions.executionTimeMs}) FILTER (WHERE ${schema.submissions.isFinal} = TRUE)`,
        solvers: countDistinct(schema.submissions.userId),
    })
        .from(schema.submissions)
        .where(inArray(schema.submissions.questionVersionId, versionIds));
    const total = Number(subStats?.total ?? 0);
    const accepted = Number(subStats?.accepted ?? 0);
    return {
        timesUsedInMatches: Number(matchUsage?.uses ?? 0),
        submissions: total,
        acceptedSubmissions: accepted,
        passRate: total > 0 ? accepted / total : 0,
        averageSolveTimeMs: subStats?.avgMs != null ? Math.round(Number(subStats.avgMs)) : null,
        distinctSolvers: Number(subStats?.solvers ?? 0),
    };
}
/** Deterministic adaptive band choice from ratings + recent accuracy. */
export function chooseTargetBandIndex(bandCount, baseIndex, userAccuracies) {
    let idx = baseIndex;
    // Aggregate signal across participants: strong recent performance pushes the
    // band up one rung, weak pulls it down. No signal leaves it unchanged.
    for (const acc of userAccuracies) {
        if (acc === null || acc === undefined)
            continue;
        if (acc >= 0.7)
            idx += 1;
        else if (acc < 0.4)
            idx -= 1;
    }
    const avgShift = userAccuracies.length > 0 ? idx - baseIndex : 0;
    const shifted = baseIndex + Math.round(avgShift / Math.max(userAccuracies.length, 1));
    return Math.min(Math.max(shifted, 0), Math.max(bandCount - 1, 0));
}
export async function selectQuestionForMatch(db, stackId, avgRating, userIds, options = {}) {
    const bands = (await db.query.difficultyBands.findMany()).sort((a, b) => a.sortOrder - b.sortOrder);
    if (bands.length === 0)
        return null;
    const preferredBand = options.preferredDifficultyId != null
        ? bands.find((b) => b.id === options.preferredDifficultyId)
        : undefined;
    const ratingBand = bands.find((b) => avgRating >= b.minRating && avgRating <= b.maxRating);
    // Adaptive base: preferred (explicit player choice) > rating band > middle.
    let baseIndex = preferredBand
        ? bands.indexOf(preferredBand)
        : ratingBand
            ? bands.indexOf(ratingBand)
            : Math.floor(bands.length / 2);
    // Adaptive adjustment from recent per-user solve rates (deterministic).
    const accuracies = [];
    for (const userId of userIds) {
        const rows = await db.query.userQuestionStats.findMany({
            where: eq(schema.userQuestionStats.userId, userId),
            limit: 50,
            orderBy: (s, { desc }) => [desc(s.lastAttemptAt)],
        });
        if (rows.length >= 3) {
            const attempts = rows.reduce((n, r) => n + r.attempts, 0);
            const solved = rows.reduce((n, r) => n + r.solved, 0);
            accuracies.push(attempts > 0 ? solved / attempts : 0.5);
        }
    }
    const targetIndex = chooseTargetBandIndex(bands.length, baseIndex, accuracies);
    const targetBand = bands[targetIndex];
    if (!targetBand)
        return null;
    baseIndex = bands.indexOf(targetBand);
    const supported = await db.query.questionStackSupport.findMany({
        where: eq(schema.questionStackSupport.stackId, stackId),
    });
    const questionIds = supported.map((s) => s.questionId);
    if (questionIds.length === 0)
        return null;
    const history = await db.query.userQuestionHistory.findMany({
        where: and(inArray(schema.userQuestionHistory.userId, userIds), inArray(schema.userQuestionHistory.questionId, questionIds)),
    });
    const timesSeenByQuestion = new Map();
    for (const h of history) {
        timesSeenByQuestion.set(h.questionId, (timesSeenByQuestion.get(h.questionId) ?? 0) + 1);
    }
    const baseWhere = and(inArray(schema.questions.id, questionIds), eq(schema.questions.status, 'published'));
    // Load ALL published supported candidates once; filter + walk bands in
    // memory. Pool sizes are bounded by the question bank, and this guarantees
    // fallback without extra round-trips.
    const allCandidates = await db.query.questions.findMany({
        where: baseWhere,
        with: { versions: { with: { testCases: true } } },
    });
    const selectable = allCandidates.filter(isSelectableCandidate);
    if (selectable.length === 0)
        return null;
    // Preferred band pool first, then adjacent bands — never a deadlock.
    const walk = bandWalkOrder(selectable.map((q) => bands.find((b) => b.id === q.difficultyId)?.sortOrder ?? targetBand.sortOrder), targetBand.sortOrder);
    let pool = [];
    let resolvedTargetSortOrder = targetBand.sortOrder;
    for (const sortOrder of walk) {
        const inBand = selectable.filter((q) => bands.find((b) => b.id === q.difficultyId)?.sortOrder === sortOrder);
        if (inBand.length > 0) {
            pool = inBand;
            resolvedTargetSortOrder = sortOrder;
            break;
        }
    }
    if (pool.length === 0)
        pool = selectable;
    const seenRows = history;
    const decorated = pool.map((q) => ({
        ...q,
        timesSeen: seenRows.find((h) => h.questionId === q.id)?.timesSeen ?? 0,
        bandSortOrder: bands.find((b) => b.id === q.difficultyId)?.sortOrder ?? resolvedTargetSortOrder,
    }));
    // Prefer unseen questions; fall back to the full pool otherwise.
    const unseen = decorated.filter((q) => q.timesSeen === 0);
    const finalPool = unseen.length > 0 ? unseen : decorated;
    const picked = pickBest(finalPool, resolvedTargetSortOrder, [...userIds].sort());
    if (!picked)
        return null;
    const version = picked.versions.filter((v) => v.publishedAt !== null).sort((a, b) => a.version - b.version).at(-1) ??
        undefined;
    if (!version)
        return null;
    for (const userId of userIds) {
        await db
            .insert(schema.userQuestionHistory)
            .values({ userId, questionId: picked.id })
            .onConflictDoUpdate({
            target: [schema.userQuestionHistory.userId, schema.userQuestionHistory.questionId],
            set: {
                lastSeenAt: new Date(),
                timesSeen: sql `${schema.userQuestionHistory.timesSeen} + 1`,
            },
        });
    }
    return { question: picked, version, difficultyId: picked.difficultyId };
}
export async function getQuestionForEditor(db, questionVersionId) {
    const version = await db.query.questionVersions.findFirst({
        where: eq(schema.questionVersions.id, questionVersionId),
        with: {
            question: true,
            testCases: true,
        },
    });
    if (!version)
        return null;
    return {
        ...version,
        testCases: version.testCases.filter((t) => t.visibility === 'public'),
    };
}
//# sourceMappingURL=service.js.map