import { and, eq, inArray, sql } from 'drizzle-orm';
import { schema } from '@clutch/db';
/**
 * Explore / discovery hub data. Spectator visibility is EXPLICIT: live
 * matches expose only public identifiers, handles, avatars, stack,
 * difficulty and server-authoritative timing. Spectator snapshots include
 * public test cases and per-participant progress but NEVER source code or
 * hidden tests.
 */
const LIVE_STATUSES = ['matched', 'starting', 'active', 'evaluating'];
export async function listLiveMatches(db, limit = 10) {
    const rows = await db.query.matches.findMany({
        where: inArray(schema.matches.status, [...LIVE_STATUSES]),
        with: {
            stack: true,
            participants: { with: { user: { with: { profile: true } } } },
        },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
        limit,
    });
    return rows.map((m) => ({
        publicId: m.publicId,
        stackId: m.stackId,
        stackName: m.stack.name,
        difficultyId: m.difficultyId,
        status: m.status,
        ranked: m.ranked,
        timeLimitSec: m.timeLimitSec,
        startedAt: m.startedAt?.toISOString() ?? null,
        endsAt: m.endsAt?.toISOString() ?? null,
        serverTimeMs: Date.now(),
        players: m.participants.map((p) => ({
            handle: p.user.profile?.handle ?? null,
            avatarUrl: p.user.profile?.avatarUrl ?? null,
            slot: p.slot,
        })),
    }));
}
/** Recent resolved results for the Explore feed. */
export async function listRecentResults(db, limit = 10) {
    const rows = await db.query.matches.findMany({
        where: and(inArray(schema.matches.status, ['resolved', 'draw']), eq(schema.matches.ranked, true)),
        with: {
            stack: true,
            participants: { with: { user: { with: { profile: true } } } },
        },
        orderBy: (m, { desc }) => [desc(m.resolvedAt)],
        limit,
    });
    return rows.map((m) => {
        const winner = m.participants.find((p) => p.userId === m.winnerUserId);
        const loser = m.participants.find((p) => p.userId !== m.winnerUserId);
        return {
            publicId: m.publicId,
            stackId: m.stackId,
            stackName: m.stack.name,
            difficultyId: m.difficultyId,
            isDraw: !m.winnerUserId,
            winnerHandle: winner?.user.profile?.handle ?? null,
            loserHandle: loser?.user.profile?.handle ?? null,
            resolvedAt: m.resolvedAt?.toISOString() ?? null,
        };
    });
}
/**
 * Spectator view of a live match by PUBLIC id. Authorization model:
 * the match must exist; only whitelisted fields are returned. Submissions
 * (source code), hidden tests and telemetry are never included.
 */
export async function getSpectatorSnapshot(db, publicId) {
    const match = await db.query.matches.findFirst({
        where: eq(schema.matches.publicId, publicId),
        with: {
            stack: true,
            questionVersion: { with: { question: true, testCases: true } },
            participants: { with: { user: { with: { profile: true } } } },
        },
    });
    if (!match)
        return null;
    // Aggregate progress from submission pass counts — no content exposed.
    const progressRows = await db
        .select({
        userId: schema.submissions.userId,
        bestPassed: sql `MAX(${schema.submissions.passedCount})`,
        attempts: sql `COUNT(*)`,
    })
        .from(schema.submissions)
        .where(eq(schema.submissions.matchId, match.id))
        .groupBy(schema.submissions.userId);
    const progressByUser = new Map(progressRows.map((r) => [r.userId, r]));
    const publicTests = match.questionVersion.testCases.filter((t) => t.visibility === 'public');
    const totalWeight = match.questionVersion.testCases.reduce((sum, t) => sum + t.weight, 0) || 1;
    return {
        publicId: match.publicId,
        status: match.status,
        stackId: match.stackId,
        stackName: match.stack.name,
        difficultyId: match.difficultyId,
        question: {
            title: match.questionVersion.question.title,
            promptMd: match.questionVersion.promptMd,
            examples: match.questionVersion.examples,
            starterCode: match.questionVersion.starterCode,
            /** Only PUBLIC test shapes are ever shown to spectators. */
            publicTestCount: publicTests.length,
        },
        timeLimitSec: match.timeLimitSec,
        startedAt: match.startedAt?.toISOString() ?? null,
        endsAt: match.endsAt?.toISOString() ?? null,
        serverTimeMs: Date.now(),
        participants: match.participants.map((p) => {
            const prog = progressByUser.get(p.userId);
            return {
                handle: p.user.profile?.handle ?? null,
                avatarUrl: p.user.profile?.avatarUrl ?? null,
                passedCount: Number(prog?.bestPassed ?? 0),
                totalWeight,
                attempts: Number(prog?.attempts ?? 0),
            };
        }),
    };
}
//# sourceMappingURL=service.js.map